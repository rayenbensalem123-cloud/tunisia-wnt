'use client'
// At-a-glance fixtures: a club's next match and last result, and the league's latest round.
// Both read the current season (or the newest one) and render nothing while there is no data.
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '@/lib/language-context'
import { fetchLeagueSeasons, fetchLeagueFixtures, type LeagueTeam, type LeagueFixture, type LeagueSeason } from '@/lib/app-data'
import { ClubMark } from '@/components/league-ui'
import { pickNext, pickLast, stamp } from '@/lib/league-pick'

type LogoFn = (x: LeagueTeam | null) => string

function useCurrentFixtures() {
  const [season, setSeason] = useState<LeagueSeason | null>(null)
  const [fixtures, setFixtures] = useState<LeagueFixture[]>([])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const seasons = await fetchLeagueSeasons()
      const s = seasons.find(x => x.isCurrent) ?? seasons[0] ?? null
      if (!alive) return
      setSeason(s)
      if (s) { const f = await fetchLeagueFixtures(s.id); if (alive) setFixtures(f) }
    })()
    return () => { alive = false }
  }, [])
  return { season, fixtures }
}

export function LeagueNextMatch({ teamId, teams, logoUrl }: { teamId: number; teams: LeagueTeam[]; logoUrl: LogoFn }) {
  const { tr, lang } = useTranslate()
  const t = tr.league
  const { fixtures } = useCurrentFixtures()
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB'
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale])
  const next = pickNext(fixtures, teamId)
  const last = pickLast(fixtures, teamId)
  if (!next && !last) return null
  const byId = (id: number) => teams.find(x => x.id === id) ?? null

  const opp = (f: LeagueFixture) => { const oid = f.homeTeamId === teamId ? f.awayTeamId : f.homeTeamId; return { x: byId(oid), home: f.homeTeamId === teamId } }
  const panel = 'flex-1 min-w-[240px] rounded-2xl border border-[rgba(var(--line-rgb),.22)] bg-gradient-to-br from-[#15294d] to-[#0c1730] p-4 text-white shadow-[0_10px_24px_rgba(2,8,23,.3)]'
  const cap = 'mb-2.5 text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744]'

  return (
    <div className="mb-6 flex flex-wrap gap-4">
      {next && (() => { const o = opp(next); return (
        <section className={panel} aria-label={t.nextMatch}>
          <p className={cap}>{t.nextMatch} · {t.matchdayN.replace('{n}', String(next.matchday))}</p>
          <div className="flex items-center gap-3">
            <ClubMark team={o.x ?? undefined} src={logoUrl(o.x)} size={42} />
            <div className="min-w-0">
              <p className="truncate text-base font-black leading-tight">{o.x?.name ?? '—'}</p>
              <p className="mt-0.5 text-xs text-white/65">{o.home ? t.homeTeam : t.awayTeam}{next.venue ? ` · ${next.venue}` : ''}</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-bold tabular-nums" dir="ltr">{next.kickoff ? dateFmt.format(new Date(next.kickoff)) : <span className="text-white/60">{t.dateTbd}</span>}</p>
        </section>
      ) })()}
      {last && (() => { const o = opp(last); const mineGoals = o.home ? last.homeGoals! : last.awayGoals!, theirs = o.home ? last.awayGoals! : last.homeGoals!
        const res = mineGoals > theirs ? 'W' : mineGoals < theirs ? 'L' : 'D'
        const tone = res === 'W' ? 'bg-emerald-500' : res === 'L' ? 'bg-rose-500' : 'bg-amber-400 text-[#0c1f3d]'
        return (
          <section className={panel} aria-label={t.lastResult}>
            <p className={cap}>{t.lastResult} · {t.matchdayN.replace('{n}', String(last.matchday))}</p>
            <div className="flex items-center gap-3">
              <ClubMark team={o.x ?? undefined} src={logoUrl(o.x)} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black leading-tight">{o.x?.name ?? '—'}</p>
                <p className="mt-0.5 text-xs text-white/65">{o.home ? t.homeTeam : t.awayTeam}</p>
              </div>
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white ${tone}`}>{res}</span>
            </div>
            <p className="mt-3 text-2xl font-black tabular-nums" dir="ltr">{mineGoals} <span className="text-white/40">–</span> {theirs}</p>
          </section>
        ) })()}
    </div>
  )
}

/** League-wide: the next matchday still to play and the latest results. */
export function LeagueRoundStrip({ teams, logoUrl, onOpen }: { teams: LeagueTeam[]; logoUrl: LogoFn; onOpen: () => void }) {
  const { tr, lang } = useTranslate()
  const t = tr.league
  const { season, fixtures } = useCurrentFixtures()
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB'
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }), [locale])
  const byId = (id: number) => teams.find(x => x.id === id) ?? null
  if (!season || fixtures.length === 0) return null

  const upcoming = fixtures.filter(f => f.status === 'scheduled')
  const nextDay = upcoming.length ? Math.min(...upcoming.map(f => f.matchday)) : null
  const nextDate = nextDay != null ? upcoming.filter(f => f.matchday === nextDay && f.kickoff).map(f => f.kickoff as string).sort()[0] : null
  const latest = fixtures.filter(f => f.status === 'played').sort((a, b) => b.matchday - a.matchday || stamp(b) - stamp(a)).slice(0, 4)

  return (
    <button onClick={onOpen} className="mb-8 block w-full rounded-2xl border border-[rgba(var(--line-rgb),.22)] bg-[var(--c-deep)] p-4 text-start transition-all hover:border-[#f6c744]/50" aria-label={t.matchdays}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {nextDay != null && (
          <div className="shrink-0">
            <p className="text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t.nextMatchday}</p>
            <p className="mt-1 text-lg font-black leading-tight">{t.matchdayN.replace('{n}', String(nextDay))}{nextDate && <span className="ms-2 text-sm font-semibold text-[var(--c-textMid)]">{dateFmt.format(new Date(nextDate))}</span>}</p>
          </div>
        )}
        {latest.length > 0 && (
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t.latestResults}</p>
            <ul className="mt-1.5 flex gap-2 overflow-hidden">
              {latest.map(f => (
                <li key={f.id} className="flex shrink-0 items-center gap-2 rounded-lg bg-white/[.05] px-2.5 py-1.5 text-xs font-bold ring-1 ring-inset ring-white/10">
                  <ClubMark team={byId(f.homeTeamId) ?? undefined} src={logoUrl(byId(f.homeTeamId))} size={18} />
                  <span className="tabular-nums" dir="ltr">{f.homeGoals}–{f.awayGoals}</span>
                  <ClubMark team={byId(f.awayTeamId) ?? undefined} src={logoUrl(byId(f.awayTeamId))} size={18} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </button>
  )
}
