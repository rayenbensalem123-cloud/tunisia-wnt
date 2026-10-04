// Storage for the staff games (Match-day Bingo picks + game scores).
//
// Shared storage lives in two Supabase tables created by supabase-games.sql. Until that script has
// been run (or if the network/permissions fail) everything transparently falls back to this
// device's localStorage, so the games always work — the result just isn't shared with other staff.
import { supabase } from "@/lib/supabase"
import type { PickEntry } from "@/lib/bingo-logic"

const LS_PICKS = "wnt-bingo-picks-v1"
const LS_SCORES = "wnt-game-scores-v1"

// null = not tried yet, false = shared tables unavailable this session
let sharedOk: boolean | null = null

const readLS = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback } catch { return fallback }
}
const writeLS = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode / quota: ignore */ }
}

export type StorageMode = "shared" | "device"

// ── Bingo picks ──────────────────────────────
type LocalPicks = Record<string, Record<string, { picks: string[]; updatedAt: string }>> // username → key → …

export async function savePicks(user: { id: string; username: string }, matchKey: string, picks: string[]): Promise<StorageMode> {
  const now = new Date().toISOString()
  if (sharedOk !== false) {
    try {
      const { error } = await supabase
        .from("bingo_picks")
        .upsert({ user_id: user.id, username: user.username, match_key: matchKey, picks, updated_at: now }, { onConflict: "user_id,match_key" })
      if (error) throw error
      sharedOk = true
      return "shared"
    } catch { sharedOk = false }
  }
  const all = readLS<LocalPicks>(LS_PICKS, {})
  all[user.username] = { ...(all[user.username] || {}), [matchKey]: { picks, updatedAt: now } }
  writeLS(LS_PICKS, all)
  return "device"
}

export async function fetchPicks(): Promise<{ entries: PickEntry[]; mode: StorageMode }> {
  if (sharedOk !== false) {
    try {
      const { data, error } = await supabase.from("bingo_picks").select("username,match_key,picks,updated_at")
      if (error) throw error
      sharedOk = true
      return {
        mode: "shared",
        entries: (data || []).map((r: any) => ({ username: r.username, matchKey: r.match_key, picks: Array.isArray(r.picks) ? r.picks : [], updatedAt: r.updated_at })),
      }
    } catch { sharedOk = false }
  }
  const all = readLS<LocalPicks>(LS_PICKS, {})
  const entries: PickEntry[] = []
  for (const [username, byKey] of Object.entries(all))
    for (const [matchKey, v] of Object.entries(byKey)) entries.push({ username, matchKey, picks: v.picks, updatedAt: v.updatedAt })
  return { entries, mode: "device" }
}

// ── Game scores (Who am I?) ──────────────────
export type ScoreRow = { username: string; best: number; plays: number }
type LocalScore = { username: string; game: string; points: number; at: string }

export async function saveScore(user: { id: string; username: string }, game: string, points: number): Promise<StorageMode> {
  if (sharedOk !== false) {
    try {
      const { error } = await supabase.from("game_scores").insert({ user_id: user.id, username: user.username, game, points })
      if (error) throw error
      sharedOk = true
      return "shared"
    } catch { sharedOk = false }
  }
  const all = readLS<LocalScore[]>(LS_SCORES, [])
  all.push({ username: user.username, game, points, at: new Date().toISOString() })
  writeLS(LS_SCORES, all.slice(-500))
  return "device"
}

export async function fetchTopScores(game: string): Promise<{ rows: ScoreRow[]; mode: StorageMode }> {
  let list: { username: string; points: number }[] | null = null
  let mode: StorageMode = "device"
  if (sharedOk !== false) {
    try {
      const { data, error } = await supabase.from("game_scores").select("username,points").eq("game", game).limit(2000)
      if (error) throw error
      sharedOk = true
      list = (data || []) as any[]
      mode = "shared"
    } catch { sharedOk = false }
  }
  if (!list) list = readLS<LocalScore[]>(LS_SCORES, []).filter(s => s.game === game)
  const by = new Map<string, ScoreRow>()
  for (const s of list) {
    const r = by.get(s.username) || { username: s.username, best: 0, plays: 0 }
    r.best = Math.max(r.best, s.points); r.plays += 1
    by.set(s.username, r)
  }
  return { rows: [...by.values()].sort((a, b) => b.best - a.best || b.plays - a.plays).slice(0, 10), mode }
}
