// Match-day Bingo — pure game logic (no React, no network), so it can be tested on its own.
//
// How it works
//  • Every staff member gets a 3×3 card for a fixture. The card is DEALT deterministically from
//    (fixture, username), so it never has to be stored and always comes back identical.
//  • Before kickoff the player "locks" up to LOCK_LIMIT squares they think will happen.
//  • Once the match is recorded, each square resolves to yes / no / void (void = the data needed
//    to judge it was not entered, e.g. no minutes recorded) and locked squares that came true score.

export type Lang = "en" | "fr" | "ar"

export type BingoMatch = {
  opponent?: string
  date?: string
  result?: string
  status?: string
  teamCategory?: string
  scorers?: { playerId: number; goals: number }[]
  yellowCards?: number[]
  redCards?: number[]
  subs?: { out: number; in: number }[]
  /** exact minute of each event: g:<playerId>:<n> goal, y:<playerId>, r:<playerId>, s:<outId>:<inId> */
  eventMinutes?: Record<string, number>
  tunisiaPossession?: string | number
  opponentPossession?: string | number
  tunisiaShots?: string | number
  opponentShots?: string | number
  tunisiaShotsOnTarget?: string | number
  opponentShotsOnTarget?: string | number
  tunisiaCorners?: string | number
  opponentCorners?: string | number
  tunisiaFouls?: string | number
  opponentFouls?: string | number
}

export const LOCK_LIMIT = 5
export const POINTS_SQUARE = 10
export const POINTS_LINE = 15

// ── helpers ──────────────────────────────────
export const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = parseInt(String(v), 10)
  return Number.isNaN(n) ? null : n
}

export const parseScore = (r?: string): [number, number] | null => {
  if (!r || !String(r).includes("-")) return null
  const [a, b] = String(r).split("-").map(x => parseInt(x.trim(), 10))
  return Number.isNaN(a) || Number.isNaN(b) ? null : [a, b]
}

/** One key for a fixture AND for the match later recorded for it (they are separate records in the app). */
export const matchKey = (m: { date?: string; opponent?: string }) =>
  `${(m.date || "").slice(0, 10)}|${(m.opponent || "").trim().toLowerCase()}`

const minuteOf = (m: BingoMatch, key: string): number | null => {
  const v = m.eventMinutes?.[key]
  return typeof v === "number" && !Number.isNaN(v) ? v : null
}

/** Minute of every Tunisia goal (null where it was not entered). */
export const goalMinutes = (m: BingoMatch): (number | null)[] => {
  const out: (number | null)[] = []
  for (const s of m.scorers || []) for (let n = 1; n <= s.goals; n++) out.push(minuteOf(m, `g:${s.playerId}:${n}`))
  return out
}
const yellowMinutes = (m: BingoMatch) => (m.yellowCards || []).map(pid => minuteOf(m, `y:${pid}`))
const subMinutes = (m: BingoMatch) => (m.subs || []).map(s => minuteOf(m, `s:${s.out}:${s.in}`))

/** Does any minute satisfy pred? true if one does, false if all are known and none do, otherwise unknown (null). */
const anyMinute = (list: (number | null)[], pred: (min: number) => boolean): boolean | null => {
  if (list.some(v => v !== null && pred(v))) return true
  if (list.length > 0 && list.every(v => v !== null)) return false
  return null
}

type Check = (m: BingoMatch) => boolean | null

const tnGoals = (m: BingoMatch) => parseScore(m.result)?.[0] ?? null
const oppGoals = (m: BingoMatch) => parseScore(m.result)?.[1] ?? null
const total = (a: unknown, b: unknown): number | null => {
  const x = toInt(a), y = toInt(b)
  return x === null && y === null ? null : (x ?? 0) + (y ?? 0)
}
const num = (a: unknown, pred: (n: number) => boolean): boolean | null => {
  const n = toInt(a)
  return n === null ? null : pred(n)
}

// scorer-based squares need the scorer list; if Tunisia scored but no scorers were entered we can't judge
const withScorers = (m: BingoMatch, f: (s: { playerId: number; goals: number }[]) => boolean): boolean | null => {
  const sc = m.scorers || []
  const g = tnGoals(m)
  if (g === 0) return false
  if (sc.length === 0) return null
  return f(sc)
}

export type Square = {
  id: string
  kind: "basic" | "minute"
  excl?: string[]
  check: Check
  label: Record<Lang, string>
}

export const SQUARES: Square[] = [
  // ── result & goals ──
  { id: "win", kind: "basic", excl: ["draw"], check: m => { const s = parseScore(m.result); return s ? s[0] > s[1] : null },
    label: { en: "Tunisia wins", fr: "La Tunisie gagne", ar: "تونس تفوز" } },
  { id: "draw", kind: "basic", excl: ["win"], check: m => { const s = parseScore(m.result); return s ? s[0] === s[1] : null },
    label: { en: "The match ends in a draw", fr: "Match nul", ar: "المباراة تنتهي بالتعادل" } },
  { id: "clean", kind: "basic", excl: ["btts"], check: m => { const g = oppGoals(m); return g === null ? null : g === 0 },
    label: { en: "Tunisia keeps a clean sheet", fr: "La Tunisie n'encaisse aucun but", ar: "تونس لا تستقبل أي هدف" } },
  { id: "btts", kind: "basic", excl: ["clean"], check: m => { const s = parseScore(m.result); return s ? s[0] >= 1 && s[1] >= 1 : null },
    label: { en: "Both teams score", fr: "Les deux équipes marquent", ar: "كلا الفريقين يسجل" } },
  { id: "tn2", kind: "basic", check: m => { const g = tnGoals(m); return g === null ? null : g >= 2 },
    label: { en: "Tunisia scores 2 or more", fr: "La Tunisie marque 2 buts ou plus", ar: "تونس تسجل هدفين أو أكثر" } },
  { id: "tn3", kind: "basic", check: m => { const g = tnGoals(m); return g === null ? null : g >= 3 },
    label: { en: "Tunisia scores 3 or more", fr: "La Tunisie marque 3 buts ou plus", ar: "تونس تسجل ثلاثة أهداف أو أكثر" } },
  { id: "over25", kind: "basic", excl: ["under3"], check: m => { const s = parseScore(m.result); return s ? s[0] + s[1] >= 3 : null },
    label: { en: "3 or more goals in the match", fr: "3 buts ou plus dans le match", ar: "ثلاثة أهداف أو أكثر في المباراة" } },
  { id: "under3", kind: "basic", excl: ["over25"], check: m => { const s = parseScore(m.result); return s ? s[0] + s[1] <= 2 : null },
    label: { en: "2 goals or fewer in the match", fr: "2 buts ou moins dans le match", ar: "هدفان أو أقل في المباراة" } },
  // ── scorers ──
  { id: "brace", kind: "basic", check: m => withScorers(m, sc => sc.some(s => s.goals >= 2)),
    label: { en: "A player scores twice", fr: "Une joueuse marque un doublé", ar: "لاعبة تسجل هدفين" } },
  { id: "twoScorers", kind: "basic", check: m => withScorers(m, sc => sc.filter(s => s.goals > 0).length >= 2),
    label: { en: "Two different Tunisia scorers", fr: "Deux buteuses différentes", ar: "هدافتان مختلفتان" } },
  { id: "subScorer", kind: "basic",
    check: m => withScorers(m, sc => { const on = new Set((m.subs || []).map(s => s.in)); return sc.some(s => on.has(s.playerId)) }),
    label: { en: "A substitute scores", fr: "Une remplaçante marque", ar: "لاعبة بديلة تسجل" } },
  // ── cards ──
  { id: "yellow", kind: "basic", excl: ["noCards"], check: m => (m.yellowCards || []).length >= 1,
    label: { en: "A yellow card for Tunisia", fr: "Un carton jaune pour la Tunisie", ar: "بطاقة صفراء لتونس" } },
  { id: "twoYellow", kind: "basic", excl: ["noCards"], check: m => (m.yellowCards || []).length >= 2,
    label: { en: "2 or more yellow cards for Tunisia", fr: "2 cartons jaunes ou plus pour la Tunisie", ar: "بطاقتان صفراوان أو أكثر لتونس" } },
  { id: "red", kind: "basic", excl: ["noCards"], check: m => (m.redCards || []).length >= 1,
    label: { en: "A red card for Tunisia", fr: "Un carton rouge pour la Tunisie", ar: "بطاقة حمراء لتونس" } },
  { id: "noCards", kind: "basic", excl: ["yellow", "twoYellow", "red"],
    check: m => (m.yellowCards || []).length + (m.redCards || []).length === 0,
    label: { en: "No cards for Tunisia", fr: "Aucun carton pour la Tunisie", ar: "لا بطاقات على تونس" } },
  // ── substitutions ──
  { id: "threeSubs", kind: "basic", check: m => (m.subs || []).length >= 3,
    label: { en: "Tunisia makes 3 or more substitutions", fr: "3 remplacements ou plus", ar: "ثلاثة تبديلات أو أكثر" } },
  // ── stats ──
  { id: "poss55", kind: "basic", check: m => num(m.tunisiaPossession, n => n >= 55),
    label: { en: "Tunisia has 55%+ possession", fr: "La Tunisie a 55 % de possession ou plus", ar: "تونس تستحوذ على 55% أو أكثر" } },
  { id: "corners8", kind: "basic", check: m => { const t = total(m.tunisiaCorners, m.opponentCorners); return t === null ? null : t >= 8 },
    label: { en: "8 or more corners in total", fr: "8 corners ou plus au total", ar: "8 ركنيات أو أكثر في المجموع" } },
  { id: "sot5", kind: "basic", check: m => num(m.tunisiaShotsOnTarget, n => n >= 5),
    label: { en: "5+ Tunisia shots on target", fr: "5 tirs cadrés ou plus pour la Tunisie", ar: "5 تسديدات على المرمى أو أكثر لتونس" } },
  { id: "fouls20", kind: "basic", check: m => { const t = total(m.tunisiaFouls, m.opponentFouls); return t === null ? null : t >= 20 },
    label: { en: "20 or more fouls in total", fr: "20 fautes ou plus au total", ar: "20 مخالفة أو أكثر في المجموع" } },
  { id: "moreShots", kind: "basic",
    check: m => { const a = toInt(m.tunisiaShots), b = toInt(m.opponentShots); return a === null || b === null ? null : a > b },
    label: { en: "Tunisia has more shots", fr: "La Tunisie a plus de tirs", ar: "تونس لديها تسديدات أكثر" } },
  // ── exact-minute squares ──
  { id: "early", kind: "minute", check: m => tnGoals(m) === 0 ? false : anyMinute(goalMinutes(m), x => x <= 15),
    label: { en: "A Tunisia goal in the first 15'", fr: "Un but tunisien dans les 15 premières minutes", ar: "هدف لتونس في أول 15 دقيقة" } },
  { id: "firstHalf", kind: "minute", check: m => tnGoals(m) === 0 ? false : anyMinute(goalMinutes(m), x => x <= 45),
    label: { en: "Tunisia scores in the first half", fr: "La Tunisie marque en première mi-temps", ar: "تونس تسجل في الشوط الأول" } },
  { id: "secondHalf", kind: "minute", check: m => tnGoals(m) === 0 ? false : anyMinute(goalMinutes(m), x => x > 45),
    label: { en: "Tunisia scores in the second half", fr: "La Tunisie marque en seconde mi-temps", ar: "تونس تسجل في الشوط الثاني" } },
  { id: "late", kind: "minute", check: m => tnGoals(m) === 0 ? false : anyMinute(goalMinutes(m), x => x >= 75),
    label: { en: "A Tunisia goal after the 75th minute", fr: "Un but tunisien après la 75e minute", ar: "هدف لتونس بعد الدقيقة 75" } },
  { id: "bothHalves", kind: "minute",
    check: m => {
      if (tnGoals(m) === 0) return false
      const gm = goalMinutes(m)
      const a = gm.some(x => x !== null && x <= 45), b = gm.some(x => x !== null && x > 45)
      if (a && b) return true
      return gm.length > 0 && gm.every(x => x !== null) ? false : null
    },
    label: { en: "Tunisia scores in both halves", fr: "La Tunisie marque dans les deux mi-temps", ar: "تونس تسجل في الشوطين" } },
  { id: "earlyYellow", kind: "minute",
    check: m => (m.yellowCards || []).length === 0 ? false : anyMinute(yellowMinutes(m), x => x <= 30),
    label: { en: "A Tunisia yellow card before the 30th minute", fr: "Un carton jaune tunisien avant la 30e minute", ar: "بطاقة صفراء لتونس قبل الدقيقة 30" } },
  { id: "earlySub", kind: "minute",
    check: m => (m.subs || []).length === 0 ? false : anyMinute(subMinutes(m), x => x < 60),
    label: { en: "First substitution before the 60th minute", fr: "Premier remplacement avant la 60e minute", ar: "أول تبديل قبل الدقيقة 60" } },
]

export const squareById = (id: string) => SQUARES.find(s => s.id === id)

// ── deterministic dealing ────────────────────
function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const conflicts = (a: Square, b: Square) => !!(a.excl?.includes(b.id) || b.excl?.includes(a.id))

/** 9 squares: 3 exact-minute squares + 6 others, no contradictory pairs, order shuffled. Same inputs → same card. */
export function dealCard(key: string, username: string): Square[] {
  const rnd = mulberry32(xmur3(`${key}#${username.trim().toLowerCase()}`)())
  const chosen: Square[] = []
  const take = (pool: Square[], upTo: number) => {
    for (const s of pool) {
      if (chosen.length >= upTo) break
      if (!chosen.some(c => conflicts(c, s))) chosen.push(s)
    }
  }
  take(shuffled(SQUARES.filter(s => s.kind === "minute"), rnd), 3)
  take(shuffled(SQUARES.filter(s => s.kind === "basic"), rnd), 9)
  return shuffled(chosen, rnd)
}

// ── resolving & scoring ──────────────────────
export type SquareState = "yes" | "no" | "void"

export const evaluateCard = (card: Square[], m: BingoMatch): SquareState[] =>
  card.map(s => { const r = s.check(m); return r === null ? "void" : r ? "yes" : "no" })

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

export function scoreCard(card: Square[], states: SquareState[], lockedIds: string[]) {
  const locked = new Set(card.map((s, i) => (lockedIds.includes(s.id) ? i : -1)).filter(i => i >= 0))
  const correct = [...locked].filter(i => states[i] === "yes")
  const lines = LINES.filter(l => l.every(i => locked.has(i) && states[i] === "yes"))
  return { points: correct.length * POINTS_SQUARE + lines.length * POINTS_LINE, correct: correct.length, lines }
}

// ── fixtures, played matches & leaderboard ───
const eventCount = (m: BingoMatch) =>
  (m.scorers?.length || 0) + (m.yellowCards?.length || 0) + (m.redCards?.length || 0) + (m.subs?.length || 0) + Object.keys(m.eventMinutes || {}).length

/** The recorded (played, approved) match for a fixture key, if any. */
export function findPlayed<T extends BingoMatch>(matches: T[], key: string): T | null {
  const cands = matches.filter(m => m.result && m.status !== "pending" && matchKey(m) === key)
  if (cands.length === 0) return null
  return cands.sort((a, b) => eventCount(b) - eventCount(a))[0]
}

export type PickEntry = { username: string; matchKey: string; picks: string[]; updatedAt?: string }
export type LeaderRow = { username: string; points: number; correct: number; lines: number; games: number }

/**
 * Season table. A pick only counts if it was saved on or before the match day
 * (the server's save time is used, so editing picks after the match doesn't pay).
 */
export function buildLeaderboard(entries: PickEntry[], matches: BingoMatch[]): LeaderRow[] {
  const rows = new Map<string, LeaderRow>()
  for (const e of entries) {
    if (!e.picks?.length) continue
    const played = findPlayed(matches, e.matchKey)
    if (!played) continue
    if (e.updatedAt && played.date && e.updatedAt.slice(0, 10) > played.date.slice(0, 10)) continue
    const card = dealCard(e.matchKey, e.username)
    const s = scoreCard(card, evaluateCard(card, played), e.picks)
    const r = rows.get(e.username) || { username: e.username, points: 0, correct: 0, lines: 0, games: 0 }
    r.points += s.points; r.correct += s.correct; r.lines += s.lines.length; r.games += 1
    rows.set(e.username, r)
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.correct - a.correct || a.username.localeCompare(b.username))
}

/** Keep only the minutes that still belong to an event in the match (events can be removed after a minute was typed). */
export function cleanEventMinutes(m: BingoMatch): Record<string, number> {
  const valid = new Set<string>()
  for (const s of m.scorers || []) for (let n = 1; n <= s.goals; n++) valid.add(`g:${s.playerId}:${n}`)
  for (const p of m.yellowCards || []) valid.add(`y:${p}`)
  for (const p of m.redCards || []) valid.add(`r:${p}`)
  for (const s of m.subs || []) valid.add(`s:${s.out}:${s.in}`)
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(m.eventMinutes || {}))
    if (valid.has(k) && typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 130) out[k] = Math.round(v)
  return out
}
