'use client'
// Results and goals over time for the Stats page. Numbers come from lib/match-stats.ts.
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslate } from '@/lib/language-context'
import { summarize, type MatchLike } from '@/lib/match-stats'

// Validated pair (CVD-safe, >= 3:1 on white): Tunisia's red for scored, blue for conceded.
const FOR = '#E30613'
const AGAINST = '#2B6CB0'
const LAST_N = 12

export function PerformanceCard({ matches }: { matches: MatchLike[] }) {
  const { tr } = useTranslate()
  const [competition, setCompetition] = useState('')
  const [year, setYear] = useState(0)
  const [table, setTable] = useState(false)
  const s = useMemo(() => summarize(matches, { competition: competition || undefined, year: year || undefined }), [matches, competition, year])
  const shown = s.series.slice(-LAST_N)
  const fill = (str: string, n: number) => str.replace('{n}', String(n))
  const tile = (label: string, value: string | number) => (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-center">
      <p className="text-sm font-black text-zinc-800 leading-none">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mt-1">{label}</p>
    </div>
  )
  const sel = 'px-1.5 py-1 rounded-md border border-zinc-200 bg-white text-[12px] font-bold text-zinc-700'

  return (
    <div className="bg-white rounded-xl border border-zinc-100 p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{tr.performance.title}</p>
        <div className="flex items-center gap-1.5">
          <select value={competition} onChange={e => setCompetition(e.target.value)} className={sel} aria-label={tr.performance.allCompetitions}>
            <option value="">{tr.performance.allCompetitions}</option>
            {s.competitions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={sel} aria-label={tr.performance.allYears}>
            <option value={0}>{tr.performance.allYears}</option>
            {s.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {s.played === 0 ? <p className="text-[12px] text-zinc-400 py-3 text-center">{tr.performance.noData}</p> : (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {tile(tr.performance.played, s.played)}{tile(tr.performance.wins, s.w)}{tile(tr.performance.draws, s.d)}{tile(tr.performance.losses, s.l)}
            {tile(tr.performance.goalsFor, s.gf)}{tile(tr.performance.goalsAgainst, s.ga)}{tile(tr.performance.winRate, `${s.winRate}%`)}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-500">{tr.performance.chartTitle}{s.series.length > LAST_N ? ` · ${fill(tr.performance.last, LAST_N)}` : ''}</p>
            <button type="button" onClick={() => setTable(t => !t)} className="text-[10px] font-black uppercase tracking-wider text-[#E30613]">
              {table ? tr.performance.showChart : tr.performance.showTable}</button>
          </div>

          {table ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] text-zinc-700">
                <thead><tr className="text-left text-[10px] uppercase tracking-wider text-zinc-400">
                  <th className="py-1 pr-2">{tr.performance.date}</th><th className="pr-2">{tr.performance.opponent}</th><th>{tr.performance.result}</th></tr></thead>
                <tbody>{shown.map(p => (
                  <tr key={p.id} className="border-t border-zinc-100"><td className="py-1 pr-2">{p.date}</td><td className="pr-2 font-bold">{p.opponent}</td><td>{p.gf}-{p.ga} ({p.outcome})</td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={shown} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke="#eceae4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={{ stroke: '#d4d4d8' }} interval={0} angle={-30} textAnchor="end" height={46} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,.04)' }} contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    labelFormatter={(_, p) => { const d: any = p?.[0]?.payload; return d ? `${d.opponent} · ${d.date}${d.competition ? ` · ${d.competition}` : ''}` : '' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
                  <Bar dataKey="gf" name={tr.performance.goalsFor} fill={FOR} radius={[4, 4, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="ga" name={tr.performance.goalsAgainst} fill={AGAINST} radius={[4, 4, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
