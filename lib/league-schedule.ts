// Round-robin fixture generator (circle method). Pure, no imports.
// n clubs -> n-1 matchdays (n even) or n matchdays with one rest per club (n odd).
// Double round robin plays the same pairings again with home and away swapped.

export interface GeneratedFixture { matchday: number; homeTeamId: number; awayTeamId: number }

/** Fisher-Yates with an injectable random source so tests are deterministic. */
export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateRoundRobin(teamIds: number[], opts: { double?: boolean; rand?: () => number } = {}): GeneratedFixture[] {
  const ids = [...new Set(teamIds)]
  if (ids.length < 2) return []
  const BYE = -1
  const order = shuffled(ids, opts.rand)
  if (order.length % 2 === 1) order.push(BYE)
  const n = order.length
  const rounds = n - 1
  const firstHalf: GeneratedFixture[] = []

  let ring = [...order]
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      let home = ring[i]
      let away = ring[n - 1 - i]
      if (home === BYE || away === BYE) continue
      // Swap home and away every other round: keeps home/away runs short for every club.
      if (r % 2 === 1) [home, away] = [away, home]
      firstHalf.push({ matchday: r + 1, homeTeamId: home, awayTeamId: away })
    }
    // rotate everything except the first element
    ring = [ring[0], ring[n - 1], ...ring.slice(1, n - 1)]
  }

  if (!opts.double) return firstHalf
  const secondHalf = firstHalf.map(f => ({ matchday: f.matchday + rounds, homeTeamId: f.awayTeamId, awayTeamId: f.homeTeamId }))
  return [...firstHalf, ...secondHalf]
}

/** Date for a matchday: first matchday on `start`, then one every `everyDays` days. Returns YYYY-MM-DD. */
export function matchdayDate(start: string, matchday: number, everyDays: number): string {
  const [y, m, d] = start.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + (matchday - 1) * everyDays))
  return dt.toISOString().slice(0, 10)
}
