// League table from played fixtures. Pure, no imports, so it is unit-tested with plain node.
// Order: points, goal difference, goals scored, then name. 3 points for a win, 1 for a draw.

export interface TableFixture {
  homeTeamId: number
  awayTeamId: number
  status: string
  homeGoals: number | null
  awayGoals: number | null
  kickoff?: string | null
  matchday?: number
}
export interface TableTeam { id: number; name: string }
export type FormResult = 'W' | 'D' | 'L'
export interface TableRow {
  teamId: number
  name: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
  /** Most recent results first, at most 5. */
  form: FormResult[]
  rank: number
}

export function computeStandings(teams: TableTeam[], fixtures: TableFixture[]): TableRow[] {
  const rows = new Map<number, TableRow>()
  for (const t of teams) rows.set(t.id, { teamId: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [], rank: 0 })

  const played = fixtures
    .filter(f => f.status === 'played' && f.homeGoals != null && f.awayGoals != null && rows.has(f.homeTeamId) && rows.has(f.awayTeamId))
    // oldest first so "form" can be built in order
    .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0) || String(a.kickoff ?? '').localeCompare(String(b.kickoff ?? '')))

  const hist = new Map<number, FormResult[]>()
  const push = (id: number, r: FormResult) => hist.set(id, [...(hist.get(id) ?? []), r])

  for (const f of played) {
    const h = rows.get(f.homeTeamId)!
    const a = rows.get(f.awayTeamId)!
    const hg = f.homeGoals as number
    const ag = f.awayGoals as number
    h.played++; a.played++
    h.gf += hg; h.ga += ag
    a.gf += ag; a.ga += hg
    if (hg > ag) { h.won++; a.lost++; h.points += 3; push(h.teamId, 'W'); push(a.teamId, 'L') }
    else if (hg < ag) { a.won++; h.lost++; a.points += 3; push(a.teamId, 'W'); push(h.teamId, 'L') }
    else { h.drawn++; a.drawn++; h.points++; a.points++; push(h.teamId, 'D'); push(a.teamId, 'D') }
  }

  const list = [...rows.values()]
  for (const r of list) {
    r.gd = r.gf - r.ga
    r.form = (hist.get(r.teamId) ?? []).slice(-5).reverse()
  }
  list.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name))

  // Clubs level on points, goal difference and goals share a rank.
  list.forEach((r, i) => {
    const prev = list[i - 1]
    r.rank = prev && prev.points === r.points && prev.gd === r.gd && prev.gf === r.gf ? prev.rank : i + 1
  })
  return list
}
