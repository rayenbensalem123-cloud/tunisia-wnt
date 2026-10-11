/**
 * Turns the text lines of a call-up PDF into camp call-ups, by matching names against the member cards.
 * Accents, case, word order and extra columns (jersey number, club, position) are ignored, and a
 * one-letter typo in a long word is forgiven. A line may hold several names (table rows).
 */
export type Person = { id: number; name: string; role?: string; position?: string }
export type CallupResult = {
  players: number[]
  staff: { id: number; role: string }[]
  unmatched: string[]
}

export const norm = (s: string): string =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z؀-ۿ]+/g, ' ')
    .trim()

const tokens = (s: string): string[] => norm(s).split(' ').filter((t) => t.length >= 2)

function lev(a: string, b: string): number {
  if (a === b) return 0
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** Index of the line token that equals (or, for long words, nearly equals) `t`; -1 when none. */
function find(line: string[], used: Set<number>, t: string): number {
  for (let i = 0; i < line.length; i++) if (!used.has(i) && line[i] === t) return i
  if (t.length >= 5)
    for (let i = 0; i < line.length; i++) if (!used.has(i) && line[i].length >= 5 && lev(line[i], t) <= 1) return i
  return -1
}

export function matchCallups(lines: string[], people: Person[]): CallupResult {
  const roster = people
    .map((p) => ({ p, t: tokens(p.name) }))
    .filter((x) => x.t.length >= 1 && x.t.join('').length >= 4)
  const players = new Set<number>()
  const staff = new Map<number, string>()
  const unmatched: string[] = []

  for (const raw of lines) {
    const line = tokens(raw)
    if (line.length === 0) continue
    const used = new Set<number>()
    let found = 0
    for (;;) {
      // best remaining person whose every name word is in the unused words of this line
      let best: { p: Person; idx: number[]; score: number } | null = null
      let tie = false
      for (const { p, t } of roster) {
        if ((p.role || '').toUpperCase() === 'PLAYERS' ? players.has(p.id) && false : false) continue
        const idx: number[] = []
        const taken = new Set(used)
        let ok = true
        for (const w of t) {
          const i = find(line, taken, w)
          if (i < 0) { ok = false; break }
          idx.push(i); taken.add(i)
        }
        if (!ok) continue
        // a single-word name only counts on a short line, so "Sara" cannot grab part of someone else's row
        if (t.length === 1 && line.length > 4) continue
        const score = t.reduce((n, w) => n + w.length, 0)
        if (!best || score > best.score) { best = { p, idx, score }; tie = false }
        else if (score === best.score && best.p.id !== p.id) tie = true
      }
      if (!best || tie) break
      best.idx.forEach((i) => used.add(i))
      found++
      if ((best.p.role || '').toUpperCase() === 'PLAYERS') players.add(best.p.id)
      else staff.set(best.p.id, (best.p.position || '').trim())
    }
    // A line that looks like a name (2+ words, mostly letters) but matched nobody is reported back.
    if (found === 0 && line.length >= 2 && line.length <= 6) unmatched.push(raw.replace(/\s+/g, ' ').trim())
  }
  return { players: [...players], staff: [...staff].map(([id, role]) => ({ id, role })), unmatched }
}
