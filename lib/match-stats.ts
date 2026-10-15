// Squad results summary for the Stats page. Pure functions, no I/O.
// A match's `result` is "<Tunisia>-<opponent>" (e.g. "2-1"); matches without a
// parsable result (not played yet) are ignored.

export interface MatchLike { id?: number | string; opponent?: string; date?: string; competition?: string; result?: string }

export function parseResult(result: string | null | undefined): { gf: number; ga: number } | null {
  const m = /^\s*(\d+)\s*[-–:]\s*(\d+)/.exec(result || '')
  return m ? { gf: Number(m[1]), ga: Number(m[2]) } : null
}

export interface SeriesPoint { id: string; label: string; date: string; opponent: string; competition: string; gf: number; ga: number; outcome: 'W' | 'D' | 'L' }
export interface Summary {
  played: number; w: number; d: number; l: number; gf: number; ga: number; winRate: number
  series: SeriesPoint[]
  competitions: string[]
  years: number[]
}

export function summarize(matches: MatchLike[], opts: { competition?: string; year?: number } = {}): Summary {
  const played: SeriesPoint[] = []
  for (const m of matches) {
    const r = parseResult(m.result)
    if (!r) continue
    played.push({
      id: String(m.id ?? `${m.date}-${m.opponent}`), label: m.opponent || '—', date: m.date || '',
      opponent: m.opponent || '', competition: m.competition || '', gf: r.gf, ga: r.ga,
      outcome: r.gf > r.ga ? 'W' : r.gf < r.ga ? 'L' : 'D',
    })
  }
  played.sort((a, b) => a.date.localeCompare(b.date))
  const competitions = [...new Set(played.map(p => p.competition).filter(Boolean))].sort()
  const years = [...new Set(played.map(p => Number(p.date.slice(0, 4))).filter(Boolean))].sort((a, b) => b - a)
  const series = played.filter(p =>
    (!opts.competition || p.competition === opts.competition) &&
    (!opts.year || p.date.startsWith(String(opts.year))))
  const w = series.filter(p => p.outcome === 'W').length
  const d = series.filter(p => p.outcome === 'D').length
  const l = series.filter(p => p.outcome === 'L').length
  return {
    played: series.length, w, d, l,
    gf: series.reduce((s, p) => s + p.gf, 0), ga: series.reduce((s, p) => s + p.ga, 0),
    winRate: series.length ? Math.round((w / series.length) * 100) : 0,
    series, competitions, years,
  }
}
