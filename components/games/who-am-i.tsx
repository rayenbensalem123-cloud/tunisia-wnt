"use client"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Check, X, RotateCcw, ChevronRight, Search } from "lucide-react"
import { saveScore, fetchTopScores, type ScoreRow, type StorageMode } from "@/lib/games-data"
import type { Lang } from "@/lib/bingo-logic"
import { GS, fmt } from "./strings"
import { sfx, Confetti, CountUp, Podium } from "./fx"

// "Who am I?" — guess the player from clues, vague → specific. Photo is the very last clue.
// Only public profile data is ever used as a clue: never passports, contracts, injuries or discipline.

type ClueKey = "position" | "country" | "club" | "age" | "height" | "jersey" | "caps" | "goals"
type Clue = { key: ClueKey; value: string }

const ROUND_SIZE = 5, BASE = 100, STEP = 12, MIN_PTS = 10
const GAME_ID = "whoami"
const WIN_SCORE = 300 // confetti + fanfare from here up

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
const shuffle = <T,>(a: T[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }
const pointsFor = (shown: number) => Math.max(MIN_PTS, BASE - STEP * (shown - 1))

const ageOf = (bd: string): number | null => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((bd || "").trim())
  if (!m) return null
  const b = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  if (isNaN(b.getTime())) return null
  const n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return a >= 10 && a <= 60 ? a : null
}
const isNum = (v: unknown) => v !== "" && v !== null && v !== undefined && !isNaN(Number(v))

function buildClues(m: any, yearsLabel: (n: number) => string): Clue[] {
  const out: Clue[] = []
  const pos = String(m.position || "").trim()
  if (pos) out.push({ key: "position", value: pos })
  const country = String(m.nationality || "").trim() || String(m.leagueRegion || "").trim()
  if (country) out.push({ key: "country", value: country })
  const club = String(m.club || "").trim()
  if (club) out.push({ key: "club", value: club })
  const age = ageOf(m.birthdate)
  if (age !== null) out.push({ key: "age", value: yearsLabel(age) })
  const h = parseInt(String(m.height || ""), 10)
  if (h > 100 && h < 230) out.push({ key: "height", value: `${h} cm` })
  if (m.jerseyNumber !== null && m.jerseyNumber !== undefined && String(m.jerseyNumber) !== "") out.push({ key: "jersey", value: `Nº ${m.jerseyNumber}` })
  if (isNum(m.natMatches)) out.push({ key: "caps", value: String(Number(m.natMatches)) })
  if (isNum(m.goals)) out.push({ key: "goals", value: String(Number(m.goals)) })
  return out
}

type Props = {
  players: any[]
  user: { id: string; username: string }
  lang: Lang
  getImage: (m: any) => string
}

type Status = "guessing" | "correct" | "failed"

export function WhoAmI({ players, user, lang, getImage }: Props) {
  const T = GS[lang]
  const yearsLabel = (n: number) => fmt(T.waYears, { n })

  // everyone with enough profile data can be a target; every named player can be guessed
  const eligible = useMemo(() => players.filter(p => buildClues(p, yearsLabel).length >= 4), [players, lang])
  const guessable = useMemo(() => players.filter(p => String(p.name || "").trim()), [players])

  const [phase, setPhase] = useState<"start" | "play" | "done">("start")
  const [round, setRound] = useState<any[]>([])
  const [idx, setIdx] = useState(0)
  const [shown, setShown] = useState(1)
  const [status, setStatus] = useState<Status>("guessing")
  const [feedback, setFeedback] = useState("")
  const [wrongTick, setWrongTick] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [query, setQuery] = useState("")
  const [burst, setBurst] = useState(0)
  const [board, setBoard] = useState<{ rows: ScoreRow[]; mode: StorageMode } | null>(null)
  const [saveMode, setSaveMode] = useState<StorageMode | null>(null)
  const savedRef = useRef(false)

  const loadBoard = () => { fetchTopScores(GAME_ID).then(setBoard).catch(() => {}) }
  useEffect(() => { loadBoard() }, [])

  const target = round[idx]
  const clues = useMemo(() => (target ? buildClues(target, yearsLabel) : []), [target, lang])
  const photo = target ? getImage(target) : ""
  const total = clues.length + (photo ? 1 : 0)
  const photoShown = !!photo && shown > clues.length
  const finished = status !== "guessing"

  const start = () => {
    const pick = shuffle(eligible).slice(0, ROUND_SIZE)
    setRound(pick); setIdx(0); setShown(1); setStatus("guessing"); setFeedback(""); setScores([]); setQuery("")
    savedRef.current = false; setSaveMode(null); setPhase("play"); sfx.clue()
  }

  const suggestions = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    return guessable.filter(p => norm(p.name).includes(q)).slice(0, 6)
  }, [query, guessable])

  const guess = (p: any) => {
    if (!target || finished) return
    setQuery("")
    if (p.id === target.id) {
      const pts = pointsFor(shown)
      setScores(s => [...s, pts]); setStatus("correct"); setFeedback(fmt(T.waCorrect, { n: pts }))
      sfx.correct(); setBurst(b => b + 1)
    } else if (shown < total) {
      setShown(s => s + 1); setFeedback(T.waWrong); setWrongTick(t => t + 1); sfx.wrong()
    } else {
      setScores(s => [...s, 0]); setStatus("failed"); setFeedback(fmt(T.waReveal, { name: target.name })); sfx.miss()
    }
  }
  const giveUp = () => {
    if (!target || finished) return
    setScores(s => [...s, 0]); setStatus("failed"); setFeedback(fmt(T.waReveal, { name: target.name })); setQuery(""); sfx.miss()
  }
  const next = () => {
    sfx.clue()
    if (idx + 1 >= round.length) { setPhase("done"); return }
    setIdx(i => i + 1); setShown(1); setStatus("guessing"); setFeedback(""); setQuery("")
  }

  const totalScore = scores.reduce((a, b) => a + b, 0)
  useEffect(() => {
    if (phase !== "done" || savedRef.current) return
    savedRef.current = true
    if (totalScore >= WIN_SCORE) { sfx.win(); setBurst(b => b + 1) }
    saveScore(user, GAME_ID, totalScore).then(m => { setSaveMode(m); loadBoard() }).catch(() => {})
  }, [phase])

  const renderBoard = () => (
    <div className="mt-6 pt-4 border-t border-[rgba(var(--line-rgb),.14)]">
      <p className="text-[11px] font-black text-[var(--c-text)] mb-3">{T.waBoard}</p>
      {board && board.rows.length > 0 ? (
        <Podium
          rows={board.rows.map(r => ({ key: r.username, name: r.username, value: String(r.best), sub: fmt(T.waPlays, { n: r.plays }) }))}
          you={user.username} youLabel={T.bgYou} unit={T.waPts}
        />
      ) : <p className="text-[10px] text-[var(--c-textDim)] font-semibold">—</p>}
      {board?.mode === "device" && <p className="mt-2 text-[9px] font-semibold text-[var(--c-textDim)] leading-relaxed">{T.bgDeviceOnly}</p>}
    </div>
  )

  // ── start ──
  if (phase === "start") {
    return (
      <div>
        <p className="text-[12px] font-semibold text-[var(--c-textMid)] leading-relaxed">{T.waDesc}</p>
        <p className="mt-3 text-[13px] font-black italic text-[#f6c744] tabular-nums">{BASE} → {MIN_PTS} {T.waPts}</p>
        {eligible.length < ROUND_SIZE ? (
          <p className="mt-4 rounded-xl border border-[#f6c744]/30 bg-[#f6c744]/8 px-4 py-3 text-[11px] font-bold text-[#f6c744] leading-relaxed">{T.waNoData}</p>
        ) : (
          <button onClick={start} className="pm-btn pm-btn-red mt-4 w-full justify-center py-3">{T.waStart}</button>
        )}
        {renderBoard()}
      </div>
    )
  }

  // ── done ──
  if (phase === "done") {
    const won = totalScore >= WIN_SCORE
    return (
      <div>
        {burst > 0 && won && <Confetti key={burst} />}
        <div className="text-center">
          <p className="text-[11px] font-black text-[var(--c-textFaint)]">{T.waDone}</p>
          <p className="mt-1 text-7xl font-black italic text-[#E30613] leading-none tabular-nums"
             style={won ? { textShadow: "0 0 28px rgba(246,199,68,.45)" } : undefined}><CountUp value={totalScore} ms={1100} /></p>
          <p className="mt-1.5 text-[10px] font-bold text-[var(--c-textDim)]">{fmt(T.waOutOf, { n: ROUND_SIZE * BASE })}</p>
        </div>
        <div className="mt-4 space-y-1.5">
          {round.map((p, i) => (
            <div key={p.id} className="gm-slide flex items-center gap-3 rounded-lg bg-[var(--c-panel4)] px-3 py-2" style={{ animationDelay: `${i * 90}ms` }}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${scores[i] > 0 ? "bg-[#7fd6a8]/18 text-[#7fd6a8]" : "bg-[#e3062c]/15 text-[#ff5f72]"}`}>
                {scores[i] > 0 ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
              </span>
              <span className="flex-1 truncate text-[11px] font-bold uppercase text-[var(--c-text)]">{p.name}</span>
              <span className={`text-sm font-black tabular-nums ${scores[i] > 0 ? "text-[#f6c744]" : "text-[var(--c-textDim)]"}`}>{scores[i] ?? 0}</span>
            </div>
          ))}
        </div>
        <button onClick={start} className="pm-btn pm-btn-red mt-5 w-full justify-center py-3"><RotateCcw size={13} />{T.waAgain}</button>
        {saveMode === "device" && <p className="mt-2 text-[9px] font-semibold text-[var(--c-textDim)] leading-relaxed">{T.bgDeviceOnly}</p>}
        {renderBoard()}
      </div>
    )
  }

  // ── play ──
  const visible = clues.slice(0, Math.min(shown, clues.length))
  const pts = pointsFor(shown)
  return (
    <div>
      {burst > 0 && status === "correct" && <Confetti key={burst} count={30} />}

      {/* round progress: one segment per player, coloured by outcome */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black text-[var(--c-textFaint)]">{fmt(T.waRound, { n: idx + 1, t: round.length })}</span>
        <span className="text-xl font-black italic text-[#f6c744] leading-none tabular-nums">{totalScore} <span className="text-[9px] not-italic text-[var(--c-textDim)]">{T.waPts}</span></span>
      </div>
      <div className="flex gap-1 mb-4">
        {round.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
            i < scores.length ? (scores[i] > 0 ? "bg-[#7fd6a8]" : "bg-[#e3062c]") : i === idx ? "bg-[#E30613]/50" : "bg-[var(--c-panel4)]"}`} />
        ))}
      </div>

      {/* points on offer: drains as clues are revealed */}
      <div className="mb-3">
        <div className="flex items-end justify-between mb-1">
          <span className="text-[10px] font-bold text-[var(--c-textDim)]">{fmt(T.waClue, { n: Math.min(shown, total), t: total })}</span>
          <span className={`text-3xl font-black italic leading-none tabular-nums ${finished ? "text-[var(--c-textDim)]" : "text-[#f6c744]"}`}>{pts}</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--c-panel4)] overflow-hidden" role="progressbar" aria-label={T.waTarget} aria-valuenow={pts} aria-valuemin={0} aria-valuemax={BASE}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pts}%`, background: "linear-gradient(90deg,#E30613,#f6c744)", opacity: finished ? 0.35 : 1 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {visible.map(c => (
          <div key={c.key} className="gm-slide relative rounded-lg bg-[var(--c-panel4)] pl-3.5 pr-3 py-2.5 overflow-hidden">
            <span className="absolute left-0 inset-y-0 w-[3px] bg-[#E30613]" />
            <p className="text-[9px] font-bold text-[var(--c-textDim)]">{(T as any)[`clue_${c.key}`]}</p>
            <p className="mt-0.5 text-[15px] font-black uppercase leading-tight text-[var(--c-text)] truncate">{c.value}</p>
          </div>
        ))}
      </div>

      {(photoShown || (finished && photo)) && (
        <div className="mt-3 gm-slide rounded-xl overflow-hidden border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="max-h-52 object-cover transition-all duration-700" style={{ filter: finished ? "none" : "blur(9px)" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
        </div>
      )}
      {!finished && photo && shown === clues.length && <p className="mt-2 text-[10px] font-semibold text-[var(--c-textDim)]">{T.waLastClue}</p>}

      {feedback && (
        <div key={`${status}-${wrongTick}-${idx}`} className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-black ${status === "guessing" ? "gm-shake" : "gm-pop"} ${
          status === "correct" ? "bg-[#7fd6a8]/12 border border-[#7fd6a8]/30 text-[#7fd6a8]"
            : status === "failed" ? "bg-[#e3062c]/10 border border-[#e3062c]/30 text-[#ff5f72]"
            : "bg-[#f6c744]/10 border border-[#f6c744]/30 text-[#f6c744]"}`}>
          {status === "correct" ? <Check size={14} strokeWidth={3} /> : status === "failed" ? <X size={14} strokeWidth={3} /> : null}{feedback}
        </div>
      )}

      {finished ? (
        <button onClick={next} className="pm-btn pm-btn-red mt-3 w-full justify-center py-3">
          {idx + 1 >= round.length ? T.waFinish : T.waNext}<ChevronRight size={14} />
        </button>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--line-rgb),.18)] bg-[var(--c-raised)] px-3 py-3 focus-within:border-[#E30613]/60 focus-within:shadow-[0_0_0_3px_rgba(227,6,44,.16)] transition-all">
            <Search size={14} className="text-[var(--c-textDim)] shrink-0" />
            <input
              value={query} onChange={e => setQuery(e.target.value)} placeholder={T.waPlaceholder} autoFocus
              onKeyDown={e => { if (e.key === "Enter" && suggestions[0]) { e.preventDefault(); guess(suggestions[0]) } }}
              className="flex-1 bg-transparent outline-none text-[13px] font-bold uppercase text-[var(--c-text)] placeholder-[var(--c-textFaint)]" />
          </div>
          {query.trim() && (
            <div className="mt-1.5 rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-raised)] overflow-hidden">
              {suggestions.length === 0
                ? <p className="px-3 py-2 text-[10px] font-bold text-[var(--c-textDim)]">{T.waNoMatch}</p>
                : suggestions.map(p => (
                  <button key={p.id} type="button" onClick={() => guess(p)}
                    className="w-full text-left px-3 py-2.5 text-[12px] font-bold uppercase text-[var(--c-text)] hover:bg-[var(--c-panel4)] hover:text-[#E30613] transition-colors">{p.name}</button>
                ))}
            </div>
          )}
          <button onClick={giveUp} className="mt-2 text-[10px] font-bold text-[var(--c-textDim)] hover:text-[#E30613] transition-colors">{T.waGiveUp}</button>
        </div>
      )}
    </div>
  )
}
