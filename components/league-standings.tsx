'use client'
// League table, calculated from the played fixtures of the selected season.
import { useMemo } from 'react'
import { useTranslate } from '@/lib/language-context'
import { computeStandings, type FormResult } from '@/lib/league-standings'
import type { LeagueTeam, LeagueFixture } from '@/lib/app-data'
import { ClubMark } from '@/components/league-ui'

type Props = {
  teams: LeagueTeam[]
  fixtures: LeagueFixture[]
  logoUrl: (x: LeagueTeam | null) => string
  myTeamId: number | null
}

const dot: Record<FormResult, string> = { W: 'bg-emerald-500', D: 'bg-amber-400', L: 'bg-rose-500' }

export function LeagueStandings({ teams, fixtures, logoUrl, myTeamId }: Props) {
  const { tr } = useTranslate()
  const t = tr.league
  const rows = useMemo(() => computeStandings(teams, fixtures), [teams, fixtures])
  const byId = useMemo(() => new Map(teams.map(x => [x.id, x])), [teams])
  const anyPlayed = fixtures.some(f => f.status === 'played')
  const th = 'px-2 py-3 text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)] text-center'
  const num = 'px-2 py-3 text-center tabular-nums text-sm font-semibold'

  if (teams.length === 0) return <p className="py-16 text-center text-sm text-[var(--c-textMid)]">{t.needTwoTeams}</p>

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-[rgba(var(--line-rgb),.22)] bg-gradient-to-b from-[#15294d] to-[#0c1730] shadow-[0_10px_24px_rgba(2,8,23,.35)]">
        <table className="w-full min-w-[560px] border-collapse text-white">
          <caption className="sr-only">{t.standings}</caption>
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className={`${th} w-10`}>#</th>
              <th scope="col" className={`${th} text-start`}>{t.colClub}</th>
              <th scope="col" className={th} title={t.colPlayedLong}>{t.colPlayed}</th>
              <th scope="col" className={th}>{t.colWon}</th>
              <th scope="col" className={th}>{t.colDrawn}</th>
              <th scope="col" className={th}>{t.colLost}</th>
              <th scope="col" className={`${th} hidden sm:table-cell`}>{t.colGf}</th>
              <th scope="col" className={`${th} hidden sm:table-cell`}>{t.colGa}</th>
              <th scope="col" className={th}>{t.colGd}</th>
              <th scope="col" className={`${th} text-[#f6c744]`}>{t.colPts}</th>
              <th scope="col" className={`${th} hidden md:table-cell`}>{t.colForm}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const x = byId.get(r.teamId) ?? null
              const mine = r.teamId === myTeamId
              return (
                <tr key={r.teamId} className={`border-b border-white/5 last:border-0 ${mine ? 'bg-[#f6c744]/10' : 'hover:bg-white/[.03]'}`}>
                  <td className={`${num} font-black ${r.rank === 1 && anyPlayed ? 'text-[#f6c744]' : 'text-white/70'}`}>{r.rank}</td>
                  <th scope="row" className="px-2 py-2.5 text-start">
                    <span className="flex items-center gap-3 min-w-0">
                      <ClubMark team={x ?? undefined} src={logoUrl(x)} size={30} />
                      <span className={`truncate text-sm font-black ${mine ? 'text-[#f6c744]' : ''}`}>{r.name}</span>
                    </span>
                  </th>
                  <td className={num}>{r.played}</td>
                  <td className={num}>{r.won}</td>
                  <td className={num}>{r.drawn}</td>
                  <td className={num}>{r.lost}</td>
                  <td className={`${num} hidden sm:table-cell`}>{r.gf}</td>
                  <td className={`${num} hidden sm:table-cell`}>{r.ga}</td>
                  <td className={num} dir="ltr">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className={`${num} text-base font-black text-[#f6c744]`}>{r.points}</td>
                  <td className="hidden md:table-cell px-2 py-3">
                    <span className="flex items-center justify-center gap-1" dir="ltr">
                      {r.form.map((f, i) => <span key={i} title={f} className={`h-2.5 w-2.5 rounded-full ${dot[f]}`} />)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[var(--c-textMid)]">{anyPlayed ? t.tiebreakNote : t.noResultsYet}</p>
    </div>
  )
}
