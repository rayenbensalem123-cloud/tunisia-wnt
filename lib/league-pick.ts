// Which fixture to show as "next" and "last" for a club. Pure, no imports.
interface PickFixture { matchday: number; status: string; kickoff: string | null; homeTeamId: number; awayTeamId: number }

export const stamp = (f: { kickoff: string | null }) => (f.kickoff ? new Date(f.kickoff).getTime() : Number.MAX_SAFE_INTEGER)

/** Next scheduled match: earliest dated one not in the past, else the lowest matchday still to play. */
export function pickNext<T extends PickFixture>(fixtures: T[], teamId: number, now = Date.now()): T | null {
  const mine = fixtures.filter(f => f.status === 'scheduled' && (f.homeTeamId === teamId || f.awayTeamId === teamId))
  const dated = mine.filter(f => f.kickoff && stamp(f) >= now - 3 * 3600_000).sort((a, b) => stamp(a) - stamp(b))
  if (dated.length) return dated[0]
  return mine.sort((a, b) => a.matchday - b.matchday)[0] ?? null
}
export function pickLast<T extends PickFixture>(fixtures: T[], teamId: number): T | null {
  const played = fixtures.filter(f => f.status === 'played' && (f.homeTeamId === teamId || f.awayTeamId === teamId))
  return played.sort((a, b) => b.matchday - a.matchday || stamp(b) - stamp(a))[0] ?? null
}

