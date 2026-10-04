"use client"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Check, X, Trophy, RotateCcw, ChevronRight, Search } from "lucide-react"
import { saveScore, fetchTopScores, type ScoreRow, type StorageMode } from "@/lib/games-data"
import type { Lang } from "@/lib/bingo-logic"
import { GS, fmt } from "./strings"

// "Who am I?" — guess the player from clues, vague → specific. Photo is the very last clue.
// Only public profile data is ever used as a clue: never passports, contracts, injuries or discipline.

type ClueKey = "position" | "country" | "club" | "age" | "height" | "jersey" | "caps" | "goals"
type Clue = { key: ClueKey; value: string }

const ROUND_SIZE = 5, BASE = 100, STEP = 12, MIN_PTS = 10
const GAME_ID = "whoami"

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
  const [scores, setScores] = useState<number[]>([])
  const [query, setQuery] = useState("")
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
    savedRef.current = false; setSaveMode(null); setPhase("play")
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
    } else if (shown < total) {
      setShown(s => s + 1); setFeedback(T.waWrong)
    } else {
      setScores(s => [...s, 0]); setStatus("failed"); setFeedback(fmt(T.waReveal, { name: target.name }))
    }
  }
  const giveUp = () => {
    if (!target || finished) return
    setScores(s => [...s, 0]); setStatus("failed"); setFeedback(fmt(T.waReveal, { name: target.name })); setQuery("")
  }
  const next = () => {
    if (idx + 1 >= round.length) { setPhase("done"); return }
    setIdx(i => i + 1); setShown(1); setStatus("guessing"); setFeedback(""); setQuery("")
  }

  const totalScore = scores.reduce((a, b) => a + b, 0)
  useEffect(() => {
    if (phase !== "done" || savedRef.current) return
    savedRef.current = true
    saveScore(user, GAME_ID, totalScore).then(m => { setSaveMode(m); loadBoard() }).catch(() => {})
  }, [phase])

  const renderBoard = () => (
    <div className="mt-5">
      <p className="text-[8px] font-black uppercase tracking-[.2em] text-[var(--c-textDim)] mb-2 flex items-center gap-1.5"><Trophy size={10} className="text-[#f6c744]" />{T.waBoard}</p>
      {board && board.rows.length > 0 ? (
        <div className="rounded-xl border border-[rgba(var(--line-rgb),.14)] overflow-hidden">
          {board.rows.map((r, i) => (
            <div key={r.username} className={`flex items-center gap-3 px-3 py-2 text-[11px] font-bold ${i % 2 ? "bg-[var(--c-panel4)]/50" : ""} ${r.username === user.username ? "text-[#f6c744]" : "text-[var(--c-text)]"}`}>
              <span className="w-4 text-[var(--c-textDim)] font-black">{i + 1}</span>
              <span className="flex-1 truncate uppercase">{r.username}{r.username === user.username && <span className="ml-2 text-[8px] text-[#E30613]">{T.bgYou}</span>}</span>
              <span className="text-[9px] text-[var(--c-textDim)]">{fmt(T.waPlays, { n: r.plays })}</span>
              <span className="font-black w-14 text-right">{r.best} {T.waPts}</span>
            </div>
          ))}
        </div>
      ) : <p className="text-[10px] text-[var(--c-textDim)] font-semibold">—</p>}
      {board?.mode === "device" && <p className="mt-2 text-[9px] font-semibold text-[var(--c-textDim)] leading-relaxed">{T.bgDeviceOnly}</p>}
    </div>
  )

  // ── start ──
  if (phase === "start") {
    return (
      <div>
        <p className="text-[12px] font-semibold text-[var(--c-textMid)] leading-relaxed">{T.waDesc}</p>
        {eligible.length < ROUND_SIZE ? (
          <p className="mt-4 rounded-xl border border-[#f6c744]/30 bg-[#f6c744]/8 px-4 py-3 text-[11px] font-bold text-[#f6c744] leading-relaxed">{T.waNoData}</p>
        ) : (
          <button onClick={start} className="pm-btn pm-btn-red mt-4 w-full justify-center">{T.waStart}</button>
        )}
        {renderBoard()}
      </div>
    )
  }

  // ── done ──
  if (phase === "done") {
    return (
      <div className="text-center">
        <p className="text-[8px] font-black uppercase tracking-[.2em] text-[var(--c-textDim)]">{T.waDone}</p>
        <p className="mt-2 text-6xl font-black italic text-[#E30613] leading-none tabular-nums">{totalScore}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--c-textFaint)]">{T.waScore} · {fmt(T.waOutOf, { n: ROUND_SIZE * BASE })}</p>
        <div className="mt-4 flex justify-center gap-1.5">
          {scores.map((s, i) => (
            <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${s > 0 ? "bg-[#7fd6a8]/15 text-[#7fd6a8]" : "bg-[#e3062c]/12 text-[#ff5f72]"}`}>{s}</span>
          ))}
        </div>
        <button onClick={start} className="pm-btn pm-btn-red mt-5 w-full justify-center"><RotateCcw size={13} />{T.waAgain}</button>
        {saveMode === "device" && <p className="mt-2 text-[9px] font-semibold text-[var(--c-textDim)] leading-relaxed">{T.bgDeviceOnly}</p>}
        <div className="text-left">{renderBoard()}</div>
      </div>
    )
  }

  // ── play ──
  const visible = clues.slice(0, Math.min(shown, clues.length))
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black uppercase tracking-[.18em] text-[var(--c-textFaint)]">{fmt(T.waRound, { n: idx + 1, t: round.length })}</span>
        <span className="text-[11px] font-black text-[#f6c744] tabular-nums">{totalScore} {T.waPts}</span>
      </div>
      <div className="flex gap-1 mb-4">
        {round.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < idx || (i === idx && finished) ? "bg-[#E30613]" : i === idx ? "bg-[#E30613]/50" : "bg-[var(--c-panel4)]"}`} />
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--c-textDim)]">{fmt(T.waClue, { n: Math.min(shown, total), t: total })}</span>
        {!finished && <span className="text-[9px] font-black text-[var(--c-textFaint)]">{pointsFor(shown)} {T.waPts}</span>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {visible.map(c => (
          <div key={c.key} className="pk-pop rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] px-3 py-2.5">
            <p className="text-[7.5px] font-black uppercase tracking-[.18em] text-[var(--c-textDim)]">{(T as any)[`clue_${c.key}`]}</p>
            <p className="mt-0.5 text-[13px] font-black uppercase text-[var(--c-text)] truncate">{c.value}</p>
          </div>
        ))}
      </div>

      {(photoShown || (finished && photo)) && (
        <div className="mt-3 pk-pop rounded-xl overflow-hidden border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel4)] flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="max-h-52 object-cover transition-all duration-500" style={{ filter: finished ? "none" : "blur(9px)" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
        </div>
      )}
      {!finished && photo && shown === clues.length && <p className="mt-2 text-[9px] font-semibold text-[var(--c-textDim)]">{T.waLastClue}</p>}

      {feedback && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-black ${
          status === "correct" ? "bg-[#7fd6a8]/12 border border-[#7fd6a8]/30 text-[#7fd6a8]"
            : status === "failed" ? "bg-[#e3062c]/10 border border-[#e3062c]/30 text-[#ff5f72]"
            : "bg-[#f6c744]/10 border border-[#f6c744]/30 text-[#f6c744]"}`}>
          {status === "correct" ? <Check size={14} /> : status === "failed" ? <X size={14} /> : null}{feedback}
        </div>
      )}

      {finished ? (
        <button onClick={next} className="pm-btn pm-btn-red mt-3 w-full justify-center">
          {idx + 1 >= round.length ? T.waFinish : T.waNext}<ChevronRight size={14} />
        </button>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--line-rgb),.18)] bg-[var(--c-raised)] px-3 py-2.5 focus-within:border-[#E30613]/60 focus-within:shadow-[0_0_0_3px_rgba(227,6,44,.16)] transition-all">
            <Search size={13} className="text-[var(--c-textDim)] shrink-0" />
            <input
              value={query} onChange={e => setQuery(e.target.value)} placeholder={T.waPlaceholder} autoFocus
              onKeyDown={e => { if (e.key === "Enter" && suggestions[0]) { e.preventDefault(); guess(suggestions[0]) } }}
              className="flex-1 bg-transparent outline-none text-[12px] font-bold uppercase text-[var(--c-text)] placeholder-[var(--c-textFaint)]" />
          </div>
          {query.trim() && (
            <div className="mt-1.5 rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-raised)] overflow-hidden">
              {suggestions.length === 0
                ? <p className="px-3 py-2 text-[10px] font-bold text-[var(--c-textDim)]">{T.waNoMatch}</p>
                : suggestions.map(p => (
                  <button key={p.id} type="button" onClick={() => guess(p)}
                    className="w-full text-left px-3 py-2 text-[11px] font-bold uppercase text-[var(--c-text)] hover:bg-[var(--c-panel4)] hover:text-[#E30613] transition-colors">{p.name}</button>
                ))}
            </div>
          )}
          <button onClick={giveUp} className="mt-2 text-[9px] font-black uppercase tracking-widest text-[var(--c-textDim)] hover:text-[#E30613] transition-colors">{T.waGiveUp}</button>
        </div>
      )}
    </div>
  )
}
