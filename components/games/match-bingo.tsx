"use client"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Check, X, Timer, Trophy, Lock, RotateCcw } from "lucide-react"
import {
  LOCK_LIMIT, POINTS_SQUARE, POINTS_LINE, dealCard, evaluateCard, scoreCard, findPlayed, matchKey, buildLeaderboard,
  type BingoMatch, type Lang, type PickEntry, type Square, type SquareState,
} from "@/lib/bingo-logic"
import { fetchPicks, savePicks, type StorageMode } from "@/lib/games-data"
import { GS, fmt } from "./strings"

const pad = (n: number) => String(n).padStart(2, "0")
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const prettyDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "")
  if (!m) return s || ""
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

// ── the 3×3 card ─────────────────────────────
function CardGrid({ card, lang, locked, states, lines, onToggle }: {
  card: Square[]; lang: Lang; locked: string[]; states?: SquareState[]; lines?: number[][]; onToggle?: (id: string) => void
}) {
  const T = GS[lang]
  const inLine = new Set((lines || []).flat())
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {card.map((sq, i) => {
          const isLocked = locked.includes(sq.id)
          const st = states?.[i]
          const base = "relative min-h-[88px] rounded-xl border p-2 text-left flex flex-col justify-between transition-all"
          const tone =
            st === "yes" ? "bg-[#7fd6a8]/14 border-[#7fd6a8]/50"
            : st === "no" ? `bg-[var(--c-panel4)] border-[rgba(var(--line-rgb),.12)] ${isLocked ? "opacity-80" : "opacity-45"}`
            : st === "void" ? "bg-[var(--c-panel4)] border-dashed border-[rgba(var(--line-rgb),.3)] opacity-70"
            : isLocked ? "bg-[#E30613]/12 border-[#E30613]/60 shadow-[0_0_0_2px_rgba(227,6,44,.12)]"
            : "bg-[var(--c-panel4)] border-[rgba(var(--line-rgb),.16)] hover:border-[#E30613]/40"
          const ring = inLine.has(i) ? "ring-2 ring-[#f6c744]" : ""
          const inner = (
            <>
              <span className="flex items-start justify-between gap-1">
                <span className={`text-[9.5px] font-black uppercase leading-snug ${st === "yes" ? "text-[#7fd6a8]" : "text-[var(--c-text)]"}`}>{sq.label[lang]}</span>
                {sq.kind === "minute" && <Timer size={11} className="shrink-0 mt-0.5 text-[#f6c744]" aria-label={T.bgMinuteHint} />}
              </span>
              <span className="flex items-center justify-between mt-1.5 min-h-[14px]">
                {st === "yes" ? <Check size={13} className="text-[#7fd6a8]" />
                  : st === "no" ? (isLocked ? <X size={13} className="text-[#ff5f72]" /> : <span />)
                  : st === "void" ? <span className="text-[7.5px] font-black uppercase tracking-wider text-[var(--c-textDim)]">n/a</span>
                  : <span />}
                {isLocked && (st === "yes"
                  ? <span className="text-[9px] font-black text-[#7fd6a8]">+{POINTS_SQUARE}</span>
                  : <Lock size={11} className="text-[#E30613]" />)}
              </span>
            </>
          )
          return onToggle && !st
            ? <button type="button" key={sq.id} onClick={() => onToggle(sq.id)} className={`${base} ${tone} ${ring}`} aria-pressed={isLocked}>{inner}</button>
            : <div key={sq.id} className={`${base} ${tone} ${ring}`}>{inner}</div>
        })}
      </div>
      {states && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-black uppercase tracking-wider text-[var(--c-textDim)]">
          <span className="flex items-center gap-1"><Check size={10} className="text-[#7fd6a8]" />{T.bgYes}</span>
          <span className="flex items-center gap-1"><X size={10} className="text-[#ff5f72]" />{T.bgNo}</span>
          <span>n/a · {T.bgVoid}</span>
        </div>
      )}
    </div>
  )
}

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
    setSavedFlash(false); setDirty(true)
    setDraft(d => d.includes(id) ? d.filter(x => x !== id) : d.length >= LOCK_LIMIT ? d : [...d, id])
  }
  const save = async () => {
    setSaving(true)
    try { await savePicks(user, selKey, draft); await reload(); setDirty(false); setSavedFlash(true) } finally { setSaving(false) }
  }

  // ── practice on a played match (nothing saved) ──
  const [practiceKey, setPracticeKey] = useState("")
  const [pDraft, setPDraft] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const practiceMatch = useMemo(() => (practiceKey ? findPlayed(approved, practiceKey) : null), [practiceKey, approved])
  const pCard = useMemo(() => (practiceKey ? dealCard(practiceKey, user.username) : []), [practiceKey, user.username])
  const pStates = useMemo(() => (practiceMatch && revealed ? evaluateCard(pCard, practiceMatch) : undefined), [practiceMatch, revealed, pCard])
  const pScore = pStates ? scoreCard(pCard, pStates, pDraft) : null
  const pToggle = (id: string) => setPDraft(d => d.includes(id) ? d.filter(x => x !== id) : d.length >= LOCK_LIMIT ? d : [...d, id])
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
    <button key={k} onClick={() => setTab(k)}
      className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tab === k ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/25" : "bg-[var(--c-panel4)] text-[var(--c-textMid)] hover:text-[var(--c-text)]"}`}>{label}</button>
  )

  const howTo = <p className="text-[10.5px] font-semibold text-[var(--c-textMid)] leading-relaxed">{fmt(T.bgHowTo, { n: LOCK_LIMIT, p: POINTS_SQUARE, l: POINTS_LINE })}</p>
  const deviceNote = mode === "device" && <p className="mt-3 text-[9px] font-semibold text-[var(--c-textDim)] leading-relaxed">{T.bgDeviceOnly}</p>

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {tabBtn("next", T.bgTabNext)}{tabBtn("results", T.bgTabResults)}{tabBtn("board", T.bgTabBoard)}
      </div>

      {/* ───────── NEXT MATCH ───────── */}
      {tab === "next" && (
        <div>
          {fixtures.length === 0 ? (
            <p className="rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] px-4 py-3 text-[11px] font-bold text-[var(--c-textMid)] leading-relaxed">{T.bgNoFixture}</p>
          ) : (
            <>
              {howTo}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fixtures.slice(0, 6).map(f => {
                  const k = matchKey(f)
                  return (
                    <button key={k} onClick={() => setSelKey(k)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${selKey === k ? "bg-[#E30613]/12 border-[#E30613]/60 text-[#E30613]" : "bg-[var(--c-panel4)] border-[rgba(var(--line-rgb),.16)] text-[var(--c-textMid)] hover:text-[var(--c-text)]"}`}>
                      {f.opponent} · {prettyDate(f.date)}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3"><CardGrid card={card} lang={lang} locked={draft} onToggle={toggle} /></div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-textFaint)]">{fmt(T.bgLocked, { n: draft.length, max: LOCK_LIMIT })}</span>
                <button onClick={save} disabled={saving || !dirty} className="pm-btn pm-btn-red">
                  {saving ? T.bgSaving : savedFlash && !dirty ? <><Check size={13} />{T.bgSaved}</> : T.bgSave}
                </button>
              </div>
            </>
          )}

          {/* practice */}
          {playedList.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[rgba(var(--line-rgb),.14)]">
              <p className="text-[8px] font-black uppercase tracking-[.2em] text-[var(--c-textDim)] mb-2">{T.bgPractice}</p>
              <div className="flex flex-wrap gap-1.5">
                {playedList.slice(0, 8).map(m => {
                  const k = matchKey(m)
                  return (
                    <button key={k} onClick={() => choosePractice(k)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${practiceKey === k ? "bg-[#f6c744]/12 border-[#f6c744]/60 text-[#f6c744]" : "bg-[var(--c-panel4)] border-[rgba(var(--line-rgb),.16)] text-[var(--c-textMid)] hover:text-[var(--c-text)]"}`}>
                      {m.opponent} · {prettyDate(m.date || "")}
                    </button>
                  )
                })}
              </div>
              {practiceMatch && (
                <div className="mt-3">
                  <p className="text-[9px] font-semibold text-[var(--c-textDim)] mb-2">{T.bgPracticeNote}</p>
                  <CardGrid card={pCard} lang={lang} locked={pDraft} states={pStates} lines={pScore?.lines} onToggle={pToggle} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {pScore ? (
                      <span className="text-[11px] font-black text-[#f6c744]">{fmt(T.bgPts, { n: pScore.points })} · {fmt(T.bgLines, { n: pScore.lines.length })} · {fmt(T.bgResultLine, { r: practiceMatch.result || "" })}</span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-textFaint)]">{fmt(T.bgLocked, { n: pDraft.length, max: LOCK_LIMIT })}</span>
                    )}
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
          {results.length === 0 ? (
            <p className="rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] px-4 py-3 text-[11px] font-bold text-[var(--c-textMid)] leading-relaxed">{T.bgNoResults}</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-[.18em] text-[var(--c-textFaint)]">{T.bgTotal}</span>
                <span className="text-xl font-black italic text-[#E30613] tabular-nums">{totalPts}</span>
              </div>
              <div className="space-y-2">
                {results.map(r => {
                  const open = openKey === r.e.matchKey
                  return (
                    <div key={r.e.matchKey} className="rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] overflow-hidden">
                      <button onClick={() => setOpenKey(open ? "" : r.e.matchKey)} className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left">
                        <span className="min-w-0">
                          <span className="block text-[11px] font-black uppercase text-[var(--c-text)] truncate">{labelFor(r.e.matchKey)}</span>
                          <span className="block text-[9px] font-bold text-[var(--c-textDim)] mt-0.5">
                            {r.played ? fmt(T.bgResultLine, { r: r.played.result || "" }) : T.bgWaiting}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-[13px] font-black text-[#f6c744]">{r.sc ? fmt(T.bgPts, { n: r.sc.points }) : "—"}</span>
                          {r.sc && <span className="block text-[8px] font-bold text-[var(--c-textDim)]">{fmt(T.bgLines, { n: r.sc.lines.length })}</span>}
                        </span>
                      </button>
                      {open && (
                        <div className="px-3.5 pb-3.5">
                          <CardGrid card={r.c} lang={lang} locked={r.e.picks} states={r.states} lines={r.sc?.lines} />
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
          {board.length === 0 ? (
            <p className="rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] px-4 py-3 text-[11px] font-bold text-[var(--c-textMid)] leading-relaxed">{T.bgBoardEmpty}</p>
          ) : (
            <div className="rounded-xl border border-[rgba(var(--line-rgb),.16)] overflow-hidden">
              <div className="grid grid-cols-[28px_1fr_44px_44px_44px_56px] gap-2 px-3 py-2 bg-[var(--c-panel4)] text-[8px] font-black uppercase tracking-wider text-[var(--c-textDim)]">
                <span>{T.bgRank}</span><span>{T.bgPlayer}</span><span className="text-right">{T.bgGames}</span><span className="text-right">{T.bgCorrect}</span><span className="text-right">{T.bgLinesCol}</span><span className="text-right">{T.waPts}</span>
              </div>
              {board.map((r, i) => (
                <div key={r.username} className={`grid grid-cols-[28px_1fr_44px_44px_44px_56px] gap-2 px-3 py-2.5 text-[11px] font-bold items-center ${r.username === user.username ? "bg-[#f6c744]/8 text-[#f6c744]" : "text-[var(--c-text)]"}`}>
                  <span className="font-black flex items-center">{i === 0 ? <Trophy size={12} className="text-[#f6c744]" /> : i + 1}</span>
                  <span className="truncate uppercase">{r.username}{r.username === user.username && <span className="ml-2 text-[8px] text-[#E30613]">{T.bgYou}</span>}</span>
                  <span className="text-right tabular-nums">{r.games}</span>
                  <span className="text-right tabular-nums">{r.correct}</span>
                  <span className="text-right tabular-nums">{r.lines}</span>
                  <span className="text-right font-black tabular-nums">{r.points}</span>
                </div>
              ))}
            </div>
          )}
          {deviceNote}
        </div>
      )}
    </div>
  )
}
