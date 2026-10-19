'use client'
// Player statistics for a season: the two leaderboards a table of results alone
// cannot answer (who scored, who assisted).
//
// These numbers are DERIVED, not typed in. An admin records who played and who
// scored on each result (the match sheet in the fixtures screen); a database
// trigger then recomputes the season. So this page only ever reads.
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '@/lib/language-context'
import { fetchLeaguePlayerStats, fetchLeagueSeasons, type LeaguePlayerStat } from '@/lib/app-data'
import { ClubMark } from '@/components/league-ui'
import type { LeagueTeam } from '@/lib/app-data'

type Props = {
  teams: LeagueTeam[]
  logoUrl: (x: LeagueTeam | null) => string
  admin: boolean
  myTeamId: number | null
}

type Key = 'goals' | 'assists'

const MEDALS = [
  'bg-gradient-to-br from-[#fff3c4] via-[#f6c744] to-[#d9a916] text-[#1a1408] shadow-[0_0_12px_rgba(246,199,68,.35)]',
  'bg-zinc-200 text-zinc-600',
  'bg-[#f0d2b8] text-[#7c4a20]',
]

export function LeaguePlayerStats({ teams, logoUrl, admin, myTeamId }: Props) {
  const { tr } = useTranslate()
  const t = tr.league

  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [rows, setRows] = useState<LeaguePlayerStat[]>([])
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState<Key>('goals')

  const byId = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])

  // Stats belong to a season, so resolve the same one the rest of the league page
  // shows: the current season, else the newest one.
  useEffect(() => {
    let alive = true
    fetchLeagueSeasons().then((seasons) => {
      if (!alive) return
      setSeasonId((seasons.find((s) => s.isCurrent) ?? seasons[0])?.id ?? null)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (seasonId == null) { setRows([]); setLoading(false); return }
    let alive = true
    setLoading(true)
    fetchLeaguePlayerStats(seasonId)
      .then((d) => { if (alive) setRows(d) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [seasonId])

  const board = useMemo(() => {
    // Rows with nothing in the chosen column sink below a divider rather than
    // padding the table with zeroes.
    const top = rows.filter((r) => r[key] > 0)
      .sort((a, b) => (b[key] - a[key]) || (b.goals - a.goals) || a.name.localeCompare(b.name))
    const rest = rows.filter((r) => r[key] === 0)
      .sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists) || a.name.localeCompare(b.name))
    return { top, rest }
  }, [rows, key])

  if (seasonId == null) {
    return <p className="py-16 text-center text-sm text-[var(--c-textMid)]">{t.noSeasonsClub}</p>
  }

  const th = 'px-2 py-3 text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)] text-center'
  const thStart = 'px-2 py-3 text-start text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)]'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['goals', 'assists'] as const).map((k) => (
          <button key={k} onClick={() => setKey(k)} aria-pressed={key === k}
            className={`px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[.16em] transition-all ring-1 ring-inset ${key === k ? 'bg-[#E30613] text-white ring-[#E30613]' : 'text-[var(--c-textMid)] ring-[rgba(var(--line-rgb),.3)] hover:ring-[#f6c744]/60 hover:text-[var(--c-text)]'}`}>
            {k === 'goals' ? t.topScorers : t.topAssists}
          </button>
        ))}
      </div>

      {admin && (
        <p className="rounded-xl border border-[rgba(var(--line-rgb),.2)] bg-[var(--c-deep)] px-4 py-3 text-[10px] font-bold leading-relaxed text-[var(--c-textMid)]">
          {t.statsFromResults}
        </p>
      )}

      {loading && rows.length === 0 && <p className="py-10 text-center text-sm text-[var(--c-textMid)]">{t.loading}</p>}

      {!loading && rows.length === 0 && (
        <p className="py-16 text-center text-sm text-[var(--c-textMid)]">{t.noStatsYet}</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[rgba(var(--line-rgb),.22)] bg-gradient-to-b from-[#15294d] to-[#0c1730] shadow-[0_10px_24px_rgba(2,8,23,.35)]">
          <table className="w-full min-w-[520px] border-collapse text-white">
            <caption className="sr-only">{key === 'goals' ? t.topScorers : t.topAssists}</caption>
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className={`${th} w-10`}>#</th>
                <th scope="col" className={thStart}>{t.fullName}</th>
                <th scope="col" className={`${thStart} hidden sm:table-cell`}>{t.clubWord}</th>
                <th scope="col" className={th}>{t.appearances}</th>
                <th scope="col" className={th}>{t.goals}</th>
                <th scope="col" className={th}>{t.assists}</th>
                <th scope="col" className={`${th} hidden md:table-cell`}>{t.yellows}</th>
                <th scope="col" className={`${th} hidden md:table-cell`}>{t.reds}</th>
              </tr>
            </thead>
            <tbody>
              {board.top.map((r, i) => {
                const team = r.teamId != null ? byId.get(r.teamId) ?? null : null
                return (
                  <tr key={r.memberId}
                    className={`border-t border-white/[.07] ${r.teamId != null && r.teamId === myTeamId ? 'bg-[#f6c744]/[.07]' : ''}`}>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-grid place-items-center w-6 h-6 rounded-md text-[10px] font-black ${MEDALS[i] ?? 'bg-white/10 text-white/60'}`}>{i + 1}</span>
                    </td>
                    <td className="px-2 py-2.5 text-[13px] font-bold">{r.name}</td>
                    <td className="px-2 py-2.5 hidden sm:table-cell">
                      <span className="flex items-center gap-2">
                        <ClubMark team={team ?? undefined} src={logoUrl(team)} size={20} />
                        <span className="text-[12px] text-white/70 truncate">{r.teamName ?? '—'}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-sm font-semibold tabular-nums text-white/70">{r.appearances}</td>
                    <td className="px-2 py-2.5 text-center text-sm font-black tabular-nums">{r.goals}</td>
                    <td className="px-2 py-2.5 text-center text-sm font-black tabular-nums">{r.assists}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums text-amber-300/80 hidden md:table-cell">{r.yellows}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums text-rose-300/80 hidden md:table-cell">{r.reds}</td>
                  </tr>
                )
              })}
              {/* Players with nothing in this column yet stay in the table, below a
                  divider, rather than disappearing. */}
              {board.rest.length > 0 && (
                <tr className="border-t border-white/10">
                  <td colSpan={8} className="px-3 pt-4 pb-1 text-[9px] font-black uppercase tracking-[.18em] text-white/35">
                    {board.rest.length} — {t.noContribYet}
                  </td>
                </tr>
              )}
              {board.rest.map((r) => (
                <tr key={r.memberId} className="border-t border-white/[.05] opacity-60">
                  <td className="px-3 py-2 text-center text-xs text-white/30">—</td>
                  <td className="px-2 py-2 text-[12px] text-white/70">{r.name}</td>
                  <td className="px-2 py-2 text-[11px] text-white/45 hidden sm:table-cell truncate">{r.teamName ?? '—'}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{r.appearances}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{r.goals}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{r.assists}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums hidden md:table-cell">{r.yellows}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums hidden md:table-cell">{r.reds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
