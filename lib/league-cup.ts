// Knockout helpers. Pure, no imports.
export interface CupScore {
  status: string
  homeTeamId: number | null
  awayTeamId: number | null
  homeGoals: number | null
  awayGoals: number | null
  homePens: number | null
  awayPens: number | null
}

/** Winning club id of a played match, or null (not played, undecided or no result). */
export function cupWinner(m: CupScore): number | null {
  if (m.status !== 'played' || m.homeGoals == null || m.awayGoals == null || m.homeTeamId == null || m.awayTeamId == null) return null
  if (m.homeGoals > m.awayGoals) return m.homeTeamId
  if (m.awayGoals > m.homeGoals) return m.awayTeamId
  if (m.homePens == null || m.awayPens == null || m.homePens === m.awayPens) return null
  return m.homePens > m.awayPens ? m.homeTeamId : m.awayTeamId
}

/** Translation key for a round given the number of clubs left in it. */
export function roundKey(round: number): 'roundFinal' | 'roundSemi' | 'roundQuarter' | 'roundR16' | 'roundR32' | 'roundR64' {
  return ({ 2: 'roundFinal', 4: 'roundSemi', 8: 'roundQuarter', 16: 'roundR16', 32: 'roundR32', 64: 'roundR64' } as const)[round as 2 | 4 | 8 | 16 | 32 | 64] ?? 'roundR64'
}

/** Lowest unused slot number in a round (1-based), or null when the round is full. */
export function nextFreeSlot(round: number, usedSlots: number[]): number | null {
  const max = round / 2
  for (let s = 1; s <= max; s++) if (!usedSlots.includes(s)) return s
  return null
}
