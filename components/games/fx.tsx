"use client"
import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { Volume2, VolumeX, Trophy } from "lucide-react"

// Shared effects for the staff games: sound (synthesized, no audio files), confetti,
// count-up numbers and the leaderboard podium. Everything respects reduced-motion,
// and sound can be muted (remembered on this device).

// ── mute state ───────────────────────────────
const LS_MUTE = "wnt-games-muted-v1"
let muted = false
let loaded = false
const subs = new Set<() => void>()
const load = () => {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try { muted = localStorage.getItem(LS_MUTE) === "1" } catch { /* storage blocked: stay unmuted */ }
}
export const setMuted = (v: boolean) => {
  muted = v
  try { localStorage.setItem(LS_MUTE, v ? "1" : "0") } catch { /* ignore */ }
  subs.forEach(f => f())
}
export function useMuted(): boolean {
  return useSyncExternalStore(
    cb => { subs.add(cb); return () => { subs.delete(cb) } },
    () => { load(); return muted },
    () => false
  )
}

// ── sound ────────────────────────────────────
let ctx: AudioContext | null = null
const audio = (): AudioContext | null => {
  if (typeof window === "undefined") return null
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch { return null }
}
type Note = [freq: number, at: number, dur: number, type?: OscillatorType, vol?: number]
const play = (notes: Note[]) => {
  load()
  if (muted) return
  const c = audio()
  if (!c) return
  const t0 = c.currentTime
  for (const [f, at, dur, type = "sine", vol = 0.05] of notes) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t0 + at)
    g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0 + at)
    o.stop(t0 + at + dur + 0.02)
  }
}
export const sfx = {
  lock: () => play([[660, 0, 0.08, "triangle"], [990, 0.05, 0.1, "triangle"]]),
  unlock: () => play([[440, 0, 0.09, "triangle", 0.035]]),
  clue: () => play([[520, 0, 0.06, "triangle", 0.035]]),
  hit: () => play([[784, 0, 0.1, "sine", 0.06], [1175, 0.07, 0.18, "sine", 0.06]]),
  miss: () => play([[220, 0, 0.16, "sawtooth", 0.02]]),
  correct: () => play([[659, 0, 0.1, "sine", 0.06], [880, 0.08, 0.1, "sine", 0.06], [1319, 0.16, 0.25, "sine", 0.06]]),
  wrong: () => play([[196, 0, 0.18, "square", 0.02], [165, 0.12, 0.22, "square", 0.02]]),
  line: () => play([[523, 0, 0.12, "triangle"], [659, 0.1, 0.12, "triangle"], [784, 0.2, 0.12, "triangle"], [1047, 0.3, 0.3, "triangle", 0.07]]),
  win: () => play([
    [523, 0, 0.14, "triangle", 0.06], [659, 0.12, 0.14, "triangle", 0.06], [784, 0.24, 0.14, "triangle", 0.06],
    [1047, 0.36, 0.14, "triangle", 0.07], [784, 0.5, 0.1, "triangle", 0.05], [1047, 0.58, 0.4, "triangle", 0.07],
  ]),
}

export function SoundToggle({ onLabel, offLabel }: { onLabel: string; offLabel: string }) {
  const m = useMuted()
  return (
    <button
      type="button"
      onClick={() => { setMuted(!m); if (m) sfx.clue() }}
      title={m ? offLabel : onLabel}
      aria-label={m ? offLabel : onLabel}
      aria-pressed={!m}
      className="pm-close"
    >
      {m ? <VolumeX size={14} /> : <Volume2 size={14} />}
    </button>
  )
}

// ── motion helpers ───────────────────────────
export function useReducedMotion(): boolean {
  const [r, setR] = useState(false)
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined
    if (!mq) return
    setR(mq.matches)
    const h = (e: MediaQueryListEvent) => setR(e.matches)
    mq.addEventListener?.("change", h)
    return () => mq.removeEventListener?.("change", h)
  }, [])
  return r
}

const CONFETTI_COLORS = ["#E30613", "#f6c744", "#EDEFF4", "#ff5f72", "#7fd6a8"]
/** A one-off burst of paper. Mount it with a fresh `key` to fire again; it removes itself. */
export function Confetti({ count = 46 }: { count?: number }) {
  const reduced = useReducedMotion()
  const [gone, setGone] = useState(false)
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      dx: (Math.random() - 0.5) * 160,
      delay: Math.random() * 0.45,
      dur: 1.9 + Math.random() * 1.3,
      rot: 360 + Math.random() * 540,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
    [count]
  )
  useEffect(() => { const t = setTimeout(() => setGone(true), 4200); return () => clearTimeout(t) }, [])
  if (reduced || gone) return null
  return (
    <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 600 }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute", top: 0, left: `${p.left}%`, width: p.w, height: p.h, background: p.color, borderRadius: 2,
            animation: `gm-confetti ${p.dur}s ${p.delay}s cubic-bezier(.3,.6,.4,1) both`,
            ["--dx" as string]: `${p.dx}px`, ["--rot" as string]: `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

export function CountUp({ value, ms = 900 }: { value: number; ms?: number }) {
  const reduced = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (reduced || value <= 0) { setN(value); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduced, ms])
  return <>{n}</>
}

// ── leaderboard podium ───────────────────────
export type PodiumRow = { key: string; name: string; value: string; sub?: string }

export function Podium({ rows, you, youLabel, unit }: { rows: PodiumRow[]; you: string; youLabel: string; unit: string }) {
  const top = rows.slice(0, 3)
  const order = [1, 0, 2].filter(i => top[i])
  const look = (rank: number) =>
    rank === 0 ? { h: 84, bg: "linear-gradient(180deg,#f6c744,#c9971a)", fg: "#0c1f3d" }
      : rank === 1 ? { h: 60, bg: "linear-gradient(180deg,#dfe6f2,#8fa0bd)", fg: "#0c1f3d" }
      : { h: 44, bg: "linear-gradient(180deg,#d9a273,#8f5d36)", fg: "#ffffff" }
  return (
    <div>
      <div className="flex items-end justify-center gap-2 pt-2">
        {order.map(rank => {
          const r = top[rank]
          const s = look(rank)
          const mine = r.name === you
          return (
            <div key={r.key} className="flex-1 min-w-0 flex flex-col items-center gm-slide" style={{ animationDelay: `${rank * 120}ms` }}>
              {rank === 0 && <Trophy size={18} className="text-[#f6c744] mb-1" />}
              <p className={`w-full text-center truncate text-[11px] font-black uppercase ${mine ? "text-[#f6c744]" : "text-[var(--c-text)]"}`}>
                {r.name}{mine && <span className="ml-1 text-[8px] text-[#E30613]">{youLabel}</span>}
              </p>
              {r.sub && <p className="text-[9px] font-bold text-[var(--c-textDim)] mb-1.5">{r.sub}</p>}
              <div className="w-full rounded-t-lg flex items-center justify-center" style={{ height: s.h, background: s.bg, color: s.fg }}>
                <span className="text-3xl font-black italic leading-none tabular-nums">{rank + 1}</span>
              </div>
              <p className="w-full text-center py-1.5 rounded-b-lg bg-[var(--c-panel4)] text-[13px] font-black text-[var(--c-text)] tabular-nums">
                {r.value} <span className="text-[8px] text-[var(--c-textDim)]">{unit}</span>
              </p>
            </div>
          )
        })}
      </div>
      {rows.length > 3 && (
        <div className="mt-3 rounded-xl border border-[rgba(var(--line-rgb),.14)] overflow-hidden">
          {rows.slice(3).map((r, i) => {
            const mine = r.name === you
            return (
              <div key={r.key} className={`flex items-center gap-3 px-3 py-2 text-[11px] font-bold ${i % 2 ? "bg-[var(--c-panel4)]/50" : ""} ${mine ? "text-[#f6c744]" : "text-[var(--c-text)]"}`}>
                <span className="w-5 text-[var(--c-textDim)] font-black tabular-nums">{i + 4}</span>
                <span className="flex-1 truncate uppercase">{r.name}{mine && <span className="ml-2 text-[8px] text-[#E30613]">{youLabel}</span>}</span>
                {r.sub && <span className="text-[9px] text-[var(--c-textDim)]">{r.sub}</span>}
                <span className="font-black w-16 text-right tabular-nums">{r.value} {unit}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
