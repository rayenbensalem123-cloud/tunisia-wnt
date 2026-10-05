"use client"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Check, X, Timer, Lock, RotateCcw } from "lucide-react"
import {
  LOCK_LIMIT, POINTS_SQUARE, POINTS_LINE, dealCard, evaluateCard, scoreCard, findPlayed, matchKey, buildLeaderboard,
  type BingoMatch, type Lang, type PickEntry, type Square, type SquareState,
} from "@/lib/bingo-logic"
import { fetchPicks, savePicks, type StorageMode } from "@/lib/games-data"
import { GS, fmt } from "./strings"
import { sfx, Confetti, CountUp, Podium } from "./fx"

const pad = (n: number) => String(n).padStart(2, "0")
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const prettyDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "")
  if (!m) return s || ""
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

const STEP_MS = 110 // delay between tiles when a result is revealed

// ── the 3×3 card ─────────────────────────────
function CardGrid({ card, lang, locked, states, lines, onToggle, onLine }: {
  card: Square[]; lang: Lang; locked: string[]; states?: SquareState[]; lines?: number[][]
  onToggle?: (id: string) => void; onLine?: () => void
}) {
  const T = GS[lang]
  const inLine = new Set((lines || []).flat())
  const revealed = !!states

  // one sound per locked tile as it flips, then a fanfare if a line was completed
  useEffect(() => {
    if (!states) return
    const timers: ReturnType<typeof setTimeout>[] = []
    card.forEach((sq, i) => {
      if (!locked.includes(sq.id)) return
      if (states[i] === "yes") timers.push(setTimeout(() => sfx.hit(), 260 + i * STEP_MS))
      else if (states[i] === "no") timers.push(setTimeout(() => sfx.miss(), 260 + i * STEP_MS))
    })
    if (lines && lines.length > 0) {
      timers.push(setTimeout(() => { sfx.line(); onLine?.() }, 260 + card.length * STEP_MS + 350))
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  const center = (idx: number) => ({ x: (idx % 3) + 0.5, y: Math.floor(idx / 3) + 0.5 })

  return (
    <div>
      <div className="relative">
        <div className="grid grid-cols-3 gap-2">
          {card.map((sq, i) => {
            const isLocked = locked.includes(sq.id)
            const st = states?.[i]
            const interactive = !!onToggle && !st
            const tone =
              st === "yes" ? "bg-[#7fd6a8]/14 border-[#7fd6a8]/55"
              : st === "no" ? `bg-[var(--c-panel4)] border-[rgba(var(--line-rgb),.12)] ${isLocked ? "" : "opacity-45"}`
              : st === "void" ? "bg-[var(--c-panel4)] border-dashed border-[rgba(var(--line-rgb),.3)] opacity-70"
              : isLocked ? "bg-[#E30613]/14 border-[#E30613]/65 shadow-[0_6px_18px_-8px_rgba(227,6,44,.7)]"
              : "bg-[var(--c-panel4)] border-[rgba(var(--line-rgb),.16)] hover:border-[#f6c744]/50"
            const accent = st === "yes" ? "bg-[#7fd6a8]" : isLocked ? "bg-[#E30613]" : "bg-transparent"
            const cls = `relative min-h-[96px] rounded-[10px] border p-2.5 pl-3.5 text-left flex flex-col justify-between overflow-hidden transition-all duration-150 ${tone} ${revealed ? "gm-flip" : ""} ${interactive ? "active:scale-[.97]" : ""}`
            const delay = revealed ? { animationDelay: `${i * STEP_MS}ms` } : undefined
            const inner = (
              <>
                <span className={`absolute left-0 inset-y-0 w-[3px] ${accent}`} />
                {isLocked && !st && <span className="absolute top-0 right-0 w-0 h-0 border-t-[18px] border-l-[18px] border-t-[#f6c744] border-l-transparent gm-pop" />}
                <span className="flex items-start justify-between gap-1.5">
                  <span className={`text-[10px] font-bold uppercase leading-[1.28] tracking-wide ${st === "yes" ? "text-[#7fd6a8]" : "text-[var(--c-text)]"}`}>{sq.label[lang]}</span>
                  {sq.kind === "minute" && <Timer size={11} className="shrink-0 mt-0.5 text-[#f6c744]" aria-label={T.bgMinuteHint} />}
                </span>
                <span className="flex items-end justify-between mt-2 min-h-[20px]">
                  <span className={`text-[11px] font-black tabular-nums ${isLocked ? "text-[#f6c744]" : "text-[var(--c-textDim)]"}`}>+{POINTS_SQUARE}</span>
                  {st === "yes" && isLocked && <span className="gm-stamp" style={{ animationDelay: `${i * STEP_MS + 200}ms` }}><Check size={18} strokeWidth={3} className="text-[#7fd6a8]" /></span>}
                  {st === "no" && isLocked && <span className="gm-stamp" style={{ animationDelay: `${i * STEP_MS + 200}ms` }}><X size={16} strokeWidth={3} className="text-[#ff5f72]" /></span>}
                  {st === "void" && <span className="text-[8px] font-black tracking-wider text-[var(--c-textDim)]">n/a</span>}
                  {!st && isLocked && <Lock size={12} className="text-[#E30613]" />}
                </span>
              </>
            )
            return interactive
              ? <button type="button" key={sq.id} onClick={() => onToggle!(sq.id)} className={cls} style={delay} aria-pressed={isLocked}>{inner}</button>
              : <div key={sq.id} className={cls} style={delay}>{inner}</div>
          })}
        </div>

        {/* completed lines are drawn through the tiles */}
        {lines && lines.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 3 3" preserveAspectRatio="none" aria-hidden>
            {lines.map((l, k) => {
              const a = center(l[0]), b = center(l[2])
              return (
                <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} pathLength={1} stroke="#f6c744" strokeWidth={5}
                  strokeLinecap="round" vectorEffect="non-scaling-stroke" className="gm-draw"
                  style={{ animationDelay: `${260 + card.length * STEP_MS + 150 + k * 250}ms`, filter: "drop-shadow(0 0 6px rgba(246,199,68,.8))" }} />
              )
            })}
          </svg>
        )}
      </div>

      {lines && lines.length > 0 && (
        <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-[#f6c744] gm-slide" style={{ animationDelay: `${260 + card.length * STEP_MS + 300}ms` }}>
          {T.bgLineDone} +{lines.length * POINTS_LINE}
        </p>
      )}
      {states && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-[var(--c-textDim)]">
          <span className="flex items-center gap-1"><Check size={10} className="text-[#7fd6a8]" />{T.bgYes}</span>
          <span className="flex items-center gap-1"><X size={10} className="text-[#ff5f72]" />{T.bgNo}</span>
          <span>n/a · {T.bgVoid}</span>
        </div>
      )}
    </div>
  )
}

// ── lock counter: five pips that fill gold ───
function LockPips({ used, T }: { used: number; T: ReturnType<typeof getT> }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: LOCK_LIMIT }).map((_, i) => (
          <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${i < used ? "bg-[#f6c744] border-[#f6c744] shadow-[0_0_10px_rgba(246,199,68,.65)] scale-110" : "border-[rgba(var(--line-rgb),.4)]"}`} />
        ))}
      </div>
      <span className="text-[11px] font-black text-[var(--c-text)] tabular-nums">{fmt(T.bgLocked, { n: used, max: LOCK_LIMIT })}</span>
    </div>
  )
}
const getT = (l: Lang) => GS[l]

type Props = {
  matches: any[]
  user: { id: string; username: string }
  lang: Lang
}

export function MatchBingo({ matches, user, lang }: Props) {
  const T = GS[lang]
  const [tab, setTab] = useState<"next" | "results" | "board">("next")
  const [entries, setEntries] = useState<PickEntry[]>([])
  const [mode, setMode] = useState<StorageMode>("shared")
  const [burst, setBurst] = useState(0)
  const celebrate = useCallback(() => setBurst(b => b + 1), [])
  const reload = useCallback(() => fetchPicks().then(r => { setEntries(r.entries); setMode(r.mode) }).catch(() => {}), [])
  useEffect(() => { reload() }, [reload])

  const today = todayStr()
  const approved: BingoMatch[] = useMemo(() => matches.filter(m => m.status !== "pending"), [matches])

  // upcoming fixtures: dated today or later, with no recorded result yet
  const fixtures = useMemo(() => {
    const seen = new Set<string>()
    return matches
      .filter(m => m.date && m.date >= today && !m.result && !findPlayed(approved, matchKey(m)))
      .filter(m => { const k = matchKey(m); if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [matches, approved, today])

  // recorded matches (for practice and for resolving results)
  const playedList = useMemo(() => {
    const seen = new Set<string>()
    const out: BingoMatch[] = []
    for (const m of approved) {
      if (!m.result) continue
      const k = matchKey(m)
      if (seen.has(k)) continue
      seen.add(k)
      const best = findPlayed(approved, k)
      if (best) out.push(best)
    }
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [approved])

  const labelFor = (key: string) => {
    const m = matches.find(x => matchKey(x) === key)
    return m ? `${m.opponent || "?"} · ${prettyDate(m.date)}` : key
  }

  // ── next match: pick & save ──
  const [selKey, setSelKey] = useState("")
  useEffect(() => {
    if (!fixtures.some(f => matchKey(f) === selKey)) setSelKey(fixtures[0] ? matchKey(fixtures[0]) : "")
  }, [fixtures, selKey])

  const mine = useMemo(() => entries.filter(e => e.username === user.username), [entries, user.username])
  const [draft, setDraft] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  useEffect(() => {
    setDraft(mine.find(e => e.matchKey === selKey)?.picks || [])
    setDirty(false); setSavedFlash(false)
  }, [selKey, mine])

  const card = useMemo(() => (selKey ? dealCard(selKey, user.username) : []), [selKey, user.username])
  const toggle = (id: string) => {
    setSavedFlash(false)
    if (draft.includes(id)) { sfx.unlock(); setDirty(true); setDraft(draft.filter(x => x !== id)); return }
    if (draft.length >= LOCK_LIMIT) { sfx.wrong(); return }
    sfx.lock(); setDirty(true); setDraft([...draft, id])
  }
  const save = async () => {
    setSaving(true)
    try { await savePicks(user, selKey, draft); await reload(); setDirty(false); setSavedFlash(true); sfx.correct() } finally { setSaving(false) }
  }

  // ── practice on a played match (nothing saved) ──
  const [practiceKey, setPracticeKey] = useState("")
  const [pDraft, setPDraft] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const practiceMatch = useMemo(() => (practiceKey ? findPlayed(approved, practiceKey) : null), [practiceKey, approved])
  const pCard = useMemo(() => (practiceKey ? dealCard(practiceKey, user.username) : []), [practiceKey, user.username])
  const pStates = useMemo(() => (practiceMatch && revealed ? evaluateCard(pCard, practiceMatch) : undefined), [practiceMatch, revealed, pCard])
  const pScore = pStates ? scoreCard(pCard, pStates, pDraft) : null
  const pToggle = (id: string) => {
    if (pDraft.includes(id)) { sfx.unlock(); setPDraft(pDraft.filter(x => x !== id)); return }
    if (pDraft.length >= LOCK_LIMIT) { sfx.wrong(); return }
    sfx.lock(); setPDraft([...pDraft, id])
  }
  const choosePractice = (k: string) => { setPracticeKey(k); setPDraft([]); setRevealed(false) }

  // ── my results ──
  const [openKey, setOpenKey] = useState("")
  const results = useMemo(() => {
    return mine
      .filter(e => e.picks.length > 0)
      .map(e => {
        const played = findPlayed(approved, e.matchKey)
        const c = dealCard(e.matchKey, user.username)
        const states = played ? evaluateCard(c, played) : undefined
        const late = !!(played && e.updatedAt && played.date && e.updatedAt.slice(0, 10) > String(played.date).slice(0, 10))
        const sc = played && states && !late ? scoreCard(c, states, e.picks) : null
        return { e, played, c, states, sc, late }
      })
      .sort((a, b) => b.e.matchKey.localeCompare(a.e.matchKey))
  }, [mine, approved, user.username])
  const totalPts = results.reduce((a, r) => a + (r.sc?.points || 0), 0)

  const board = useMemo(() => buildLeaderboard(entries, approved), [entries, approved])

  const tabBtn = (k: typeof tab, label: string) => (
    <button key={k} onClick={() => { setTab(k); sfx.clue() }}
      className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all ${tab === k ? "border-[#E30613] text-[var(--c-text)]" : "border-transparent text-[var(--c-textDim)] hover:text-[var(--c-text)]"}`}>{label}</button>
  )
  const empty = (msg: string) => (
    <p className="rounded-xl border border-dashed border-[rgba(var(--line-rgb),.25)] px-4 py-4 text-[11px] font-bold text-[var(--c-textMid)] leading-relaxed">{msg}</p>
  )
  const howTo = <p className="text-[10.5px] font-semibold text-[var(--c-textMid)] leading-relaxed">{fmt(T.bgHowTo, { n: LOCK_LIMIT, p: POINTS_SQUARE, l: POINTS_LINE })}</p>
  const deviceNote = mode === "device" && <p className="mt-3 text-[9px] font-semibold text-[var(--c-textDim)] leading-relaxed">{T.bgDeviceOnly}</p>

  const fixtureChip = (key: string, opponent: string, date: string, active: boolean, onClick: () => void, tone: "red" | "gold") => (
    <button key={key} onClick={onClick}
      className={`text-left px-3 py-2 rounded-lg border-b-2 border border-transparent transition-all ${active
        ? (tone === "red" ? "bg-[#E30613]/12 border-b-[#E30613]" : "bg-[#f6c744]/12 border-b-[#f6c744]") + " text-[var(--c-text)]"
        : "bg-[var(--c-panel4)] border-b-transparent text-[var(--c-textMid)] hover:text-[var(--c-text)]"}`}>
      <span className="block text-[11px] font-black uppercase leading-tight">{opponent}</span>
      <span className="block text-[9px] font-bold text-[var(--c-textDim)] mt-0.5">{prettyDate(date)}</span>
    </button>
  )

  return (
    <div>
      {burst > 0 && <Confetti key={burst} />}
      <div className="flex mb-4 border-b border-[rgba(var(--line-rgb),.14)]">
        {tabBtn("next", T.bgTabNext)}{tabBtn("results", T.bgTabResults)}{tabBtn("board", T.bgTabBoard)}
      </div>

      {/* ───────── NEXT MATCH ───────── */}
      {tab === "next" && (
        <div>
          {fixtures.length === 0 ? empty(T.bgNoFixture) : (
            <>
              {howTo}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fixtures.slice(0, 6).map(f => fixtureChip(matchKey(f), f.opponent, f.date, selKey === matchKey(f), () => { setSelKey(matchKey(f)); sfx.clue() }, "red"))}
              </div>
              <div className="mt-3"><CardGrid card={card} lang={lang} locked={draft} onToggle={toggle} /></div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <LockPips used={draft.length} T={T} />
                  <p className="mt-1 text-[10px] font-bold text-[#f6c744] tabular-nums">{fmt(T.bgUpTo, { n: draft.length * POINTS_SQUARE })}</p>
                </div>
                <button onClick={save} disabled={saving || !dirty} className="pm-btn pm-btn-red">
                  {saving ? T.bgSaving : savedFlash && !dirty ? <><Check size={13} />{T.bgSaved}</> : T.bgSave}
                </button>
              </div>
            </>
          )}

          {/* practice */}
          {playedList.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[rgba(var(--line-rgb),.14)]">
              <p className="text-[11px] font-black text-[var(--c-text)] mb-2">{T.bgPractice}</p>
              <div className="flex flex-wrap gap-1.5">
                {playedList.slice(0, 8).map(m => fixtureChip(matchKey(m), m.opponent || "?", m.date || "", practiceKey === matchKey(m), () => { choosePractice(matchKey(m)); sfx.clue() }, "gold"))}
              </div>
              {practiceMatch && (
                <div className="mt-3">
                  <p className="text-[9px] font-semibold text-[var(--c-textDim)] mb-2">{T.bgPracticeNote}</p>
                  <CardGrid card={pCard} lang={lang} locked={pDraft} states={pStates} lines={pScore?.lines} onToggle={pToggle} onLine={celebrate} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {pScore ? (
                      <div>
                        <p className="text-2xl font-black italic text-[#f6c744] leading-none tabular-nums"><CountUp value={pScore.points} /> <span className="text-[10px] not-italic text-[var(--c-textDim)]">{T.waPts}</span></p>
                        <p className="mt-1 text-[9px] font-bold text-[var(--c-textDim)]">{fmt(T.bgResultLine, { r: practiceMatch.result || "" })}</p>
                      </div>
                    ) : <LockPips used={pDraft.length} T={T} />}
                    {revealed
                      ? <button onClick={() => choosePractice(practiceKey)} className="pm-btn pm-btn-ghost"><RotateCcw size={12} />{T.bgReset}</button>
                      : <button onClick={() => setRevealed(true)} disabled={pDraft.length === 0} className="pm-btn pm-btn-soft">{T.bgReveal}</button>}
                  </div>
                </div>
              )}
            </div>
          )}
          {deviceNote}
        </div>
      )}

      {/* ───────── MY RESULTS ───────── */}
      {tab === "results" && (
        <div>
          {results.length === 0 ? empty(T.bgNoResults) : (
            <>
              <div className="flex items-end justify-between mb-3 pb-3 border-b border-[rgba(var(--line-rgb),.14)]">
                <span className="text-[11px] font-black text-[var(--c-textFaint)]">{T.bgTotal}</span>
                <span className="text-4xl font-black italic text-[#E30613] leading-none tabular-nums"><CountUp value={totalPts} /></span>
              </div>
              <div className="space-y-2">
                {results.map(r => {
                  const open = openKey === r.e.matchKey
                  return (
                    <div key={r.e.matchKey} className="rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] overflow-hidden">
                      <button onClick={() => { setOpenKey(open ? "" : r.e.matchKey); sfx.clue() }} className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left">
                        <span className="min-w-0">
                          <span className="block text-[12px] font-black uppercase text-[var(--c-text)] truncate">{labelFor(r.e.matchKey)}</span>
                          <span className="block text-[9px] font-bold text-[var(--c-textDim)] mt-0.5">
                            {r.played ? fmt(T.bgResultLine, { r: r.played.result || "" }) : T.bgWaiting}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-xl font-black italic text-[#f6c744] leading-none tabular-nums">{r.sc ? r.sc.points : "—"}</span>
                          {r.sc && <span className="block text-[8px] font-bold text-[var(--c-textDim)] mt-0.5">{fmt(T.bgLines, { n: r.sc.lines.length })}</span>}
                        </span>
                      </button>
                      {open && (
                        <div className="px-3.5 pb-3.5">
                          <CardGrid card={r.c} lang={lang} locked={r.e.picks} states={r.states} lines={r.sc?.lines} onLine={celebrate} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {deviceNote}
        </div>
      )}

      {/* ───────── LEADERBOARD ───────── */}
      {tab === "board" && (
        <div>
          {board.length === 0 ? empty(T.bgBoardEmpty) : (
            <Podium
              rows={board.map(r => ({ key: r.username, name: r.username, value: String(r.points), sub: `${r.correct} ${T.bgCorrect.toLowerCase()} · ${r.games} ${T.bgGames.toLowerCase()}` }))}
              you={user.username} youLabel={T.bgYou} unit={T.waPts}
            />
          )}
          {deviceNote}
        </div>
      )}
    </div>
  )
}
