// Head-to-head record against one opponent, from the national team's own match list. Pure, no imports.
// Opponent names are compared without accents, case, "women" suffixes or French/English spelling differences.

export interface H2HMatch {
  id?: number | string; opponent?: string; date?: string; result?: string; competition?: string; venue?: string
  teamCategory?: string; scorers?: { playerId: number; goals: number }[]
}
export interface Meeting { id: string; date: string; competition: string; venue: string; gf: number; ga: number; outcome: 'W' | 'D' | 'L' }
export interface H2H {
  played: number; w: number; d: number; l: number; gf: number; ga: number; winRate: number; cleanSheets: number
  last: Meeting[]; biggestWin: Meeting | null; heaviestLoss: Meeting | null
  scorers: { playerId: number; name: string; goals: number }[]
  streak: { type: 'W' | 'D' | 'L'; n: number } | null
}

const ALIAS: Record<string, string> = {
  algerie: 'algeria', maroc: 'morocco', egypte: 'egypt', 'afrique du sud': 'south africa', cameroun: 'cameroon',
  'cote d ivoire': 'ivory coast', senegal: 'senegal', nigeria: 'nigeria', zambie: 'zambia', tanzanie: 'tanzania',
  ouganda: 'uganda', libye: 'libya', ethiopie: 'ethiopia', mauritanie: 'mauritania', 'rd congo': 'dr congo', 'republique democratique du congo': 'dr congo',
  allemagne: 'germany', espagne: 'spain', italie: 'italy', angleterre: 'england', 'pays bas': 'netherlands', 'pays-bas': 'netherlands',
  jordanie: 'jordan', palestine: 'palestine', irak: 'iraq', liban: 'lebanon', syrie: 'syria', turquie: 'turkey', grece: 'greece', roumanie: 'romania',
}

export const normOpponent = (s: string | undefined | null) => {
  let t = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  t = t.replace(/\b(women'?s?|womens|feminine|feminin|femmes?|ladies|u-?\d\d|w)\b/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  return ALIAS[t] ?? t
}

const parse = (r: string | undefined) => {
  const m = /^\s*(\d+)\s*[-–:]\s*(\d+)/.exec(r || '')
  return m ? { gf: +m[1], ga: +m[2] } : null
}

export function headToHead(matches: H2HMatch[], opponent: string, opts: { category?: string; excludeId?: number | string; names?: Record<number, string> } = {}): H2H {
  const key = normOpponent(opponent)
  const empty: H2H = { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, winRate: 0, cleanSheets: 0, last: [], biggestWin: null, heaviestLoss: null, scorers: [], streak: null }
  if (!key) return empty
  const rows: { m: H2HMatch; meet: Meeting }[] = []
  for (const m of matches) {
    if (normOpponent(m.opponent) !== key) continue
    if (opts.category && m.teamCategory && m.teamCategory !== opts.category) continue
    if (opts.excludeId != null && String(m.id) === String(opts.excludeId)) continue
    const r = parse(m.result)
    if (!r) continue
    rows.push({ m, meet: { id: String(m.id ?? `${m.date}-${m.opponent}`), date: m.date || '', competition: m.competition || '', venue: m.venue || '', gf: r.gf, ga: r.ga, outcome: r.gf > r.ga ? 'W' : r.gf < r.ga ? 'L' : 'D' } })
  }
  if (!rows.length) return empty
  rows.sort((a, b) => b.meet.date.localeCompare(a.meet.date)) // newest first
  const all = rows.map(r => r.meet)
  const w = all.filter(x => x.outcome === 'W').length, d = all.filter(x => x.outcome === 'D').length, l = all.filter(x => x.outcome === 'L').length
  const gf = all.reduce((s, x) => s + x.gf, 0), ga = all.reduce((s, x) => s + x.ga, 0)
  const margin = (x: Meeting) => x.gf - x.ga
  const wins = all.filter(x => x.outcome === 'W').sort((a, b) => margin(b) - margin(a) || b.date.localeCompare(a.date))
  const losses = all.filter(x => x.outcome === 'L').sort((a, b) => margin(a) - margin(b) || b.date.localeCompare(a.date))
  const tally = new Map<number, number>()
  for (const { m } of rows) for (const s of m.scorers ?? []) tally.set(s.playerId, (tally.get(s.playerId) ?? 0) + (s.goals || 0))
  const scorers = [...tally.entries()].map(([playerId, goals]) => ({ playerId, name: opts.names?.[playerId] ?? '', goals }))
    .filter(s => s.goals > 0 && s.name).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 3)
  let n = 0; for (const x of all) { if (x.outcome === all[0].outcome) n++; else break }
  return {
    played: all.length, w, d, l, gf, ga, winRate: Math.round((w / all.length) * 100), cleanSheets: all.filter(x => x.ga === 0).length,
    last: all.slice(0, 5), biggestWin: wins[0] ?? null, heaviestLoss: losses[0] ?? null, scorers, streak: { type: all[0].outcome, n },
  }
}
