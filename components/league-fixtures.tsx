'use client'
// Ligue Féminine: seasons, matchdays and results.
// Admin creates seasons and matches and enters scores; a club account sees the same
// fixtures read-only, with its own matches highlighted.
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, ClipboardPaste, Pencil, Plus, Trash2, Wand2, X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import {
  fetchLeagueSeasons, fetchLeagueFixtures, fetchLeagueEvents, fetchLeagueLineups, fetchLeagueRoster, createLeagueSeason, setCurrentLeagueSeason, deleteLeagueSeason,
  saveLeagueFixture, deleteLeagueFixture, bulkCreateLeagueFixtures,
  type LeagueTeam, type LeagueMatchEvent, type LeagueLineupEntry, type LeagueRosterEntry, type LeagueSeason, type LeagueFixture, type FixtureStatus, type FixtureError,
} from '@/lib/app-data'
import { ClubMark, chip, input, label, toLocalInput } from '@/components/league-ui'
import { DateField, DateTimeField, NumberField, SelectField, TimeField } from '@/components/league-pickers'
import { generateRoundRobin, matchdayDate } from '@/lib/league-schedule'
import { LeagueStandings } from '@/components/league-standings'
import { LeagueCalendar } from '@/components/league-calendar'
import { LeagueCup } from '@/components/league-cup'
import { LeagueImport } from '@/components/league-import'
import { LeagueMatchSheet, KIND_ICON } from '@/components/league-match-sheet'
import { computeSuspensions, suspendedFor } from '@/lib/league-discipline'

type Sub = 'matchdays' | 'standings' | 'calendar' | 'cup'

type Props = {
  mode: 'admin' | 'club'
  /** Every club (id, name, logo). */
  teams: LeagueTeam[]
  logoUrl: (x: LeagueTeam | null) => string
  /** The club this login belongs to (club mode), highlighted in the list. */
  myTeamId: number | null
  /** Show one section only (no section tabs). Used on a team page. */
  section?: Sub
  /** Team page: the matchdays section shows this week's round and the club's own matches. */
  scoped?: boolean
}

type FxForm = { id?: number; matchday: string; home: string; away: string; when: string; venue: string; status: FixtureStatus; hg: string; ag: string }

export function LeagueFixtures({ mode, teams, logoUrl, myTeamId, section, scoped }: Props) {
  const { tr, lang } = useTranslate()
  const t = tr.league
  const admin = mode === 'admin'
  const [seasons, setSeasons] = useState<LeagueSeason[]>([])
  const [loaded, setLoaded] = useState(false)
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [fixtures, setFixtures] = useState<LeagueFixture[]>([])
  const [matchday, setMatchday] = useState<number | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [form, setForm] = useState<FxForm | null>(null)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [seasonForm, setSeasonForm] = useState({ name: '', startsOn: '', endsOn: '', makeCurrent: true })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [subState, setSub] = useState<Sub>('matchdays')
  const sub: Sub = section ?? subState
  const [genOpen, setGenOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [events, setEvents] = useState<LeagueMatchEvent[]>([])
  const [lineups, setLineups] = useState<LeagueLineupEntry[]>([])
  const [roster, setRoster] = useState<LeagueRosterEntry[]>([])
  const [sheetId, setSheetId] = useState<number | null>(null)
  const [gen, setGen] = useState({ double: true, start: '', every: '7', time: '15:00' })

  const teamById = useMemo(() => new Map(teams.map(x => [x.id, x])), [teams])
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB'
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }), [locale])
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale])
  const errText = (e: FixtureError | null) => ({ duplicate: t.errDuplicate, sameTeam: t.errSameTeam, invalid: t.errInvalid, denied: t.errDenied, generic: t.errGeneric } as Record<string, string>)[e || 'generic']

  const loadSeasons = async (pick?: number) => {
    const list = await fetchLeagueSeasons()
    setSeasons(list); setLoaded(true)
    setSeasonId(prev => pick ?? (prev && list.some(s => s.id === prev) ? prev : (list.find(s => s.isCurrent) || list[0])?.id ?? null))
  }
  const loadFixtures = async (id: number | null) => {
    if (id == null) { setFixtures([]); setEvents([]); setLineups([]); return }
    const [f, e, l] = await Promise.all([fetchLeagueFixtures(id), fetchLeagueEvents(id), fetchLeagueLineups(id)])
    setFixtures(f); setEvents(e); setLineups(l)
  }
  useEffect(() => { if (admin && teams.length) void fetchLeagueRoster(teams.map(x => x.id)).then(setRoster) }, [admin, teams])
  const suspensions = useMemo(() => computeSuspensions(fixtures, events), [fixtures, events])
  useEffect(() => { void loadSeasons() }, [])
  useEffect(() => { void loadFixtures(seasonId); setMatchday(null) }, [seasonId])

  const season = seasons.find(s => s.id === seasonId) || null
  const days = useMemo(() => [...new Set(fixtures.map(f => f.matchday))].sort((a, b) => a - b), [fixtures])
  // Open on the first matchday that still has something to play, otherwise the last one.
  const shownDay = matchday ?? (days.find(d => fixtures.some(f => f.matchday === d && f.status !== 'played')) ?? days[days.length - 1] ?? null)
  const shown = fixtures.filter(f => f.matchday === shownDay && (!onlyMine || f.homeTeamId === myTeamId || f.awayTeamId === myTeamId))

  const openNew = () => {
    setErr('')
    setForm({ matchday: String(shownDay ?? (days.length ? days[days.length - 1] + 1 : 1)), home: '', away: '', when: '', venue: '', status: 'scheduled', hg: '', ag: '' })
  }
  const openEdit = (f: LeagueFixture) => {
    setErr('')
    setForm({ id: f.id, matchday: String(f.matchday), home: String(f.homeTeamId), away: String(f.awayTeamId), when: toLocalInput(f.kickoff), venue: f.venue || '', status: f.status, hg: f.homeGoals != null ? String(f.homeGoals) : '', ag: f.awayGoals != null ? String(f.awayGoals) : '' })
  }

  const submitMatch = async () => {
    if (!form || seasonId == null) return
    const md = Number(form.matchday), hg = Number(form.hg), ag = Number(form.ag)
    if (!Number.isInteger(md) || md < 1 || md > 99 || !form.home || !form.away) { setErr(t.errInvalid); return }
    if (form.home === form.away) { setErr(t.errSameTeam); return }
    if (form.status === 'played' && (form.hg === '' || form.ag === '' || !Number.isInteger(hg) || !Number.isInteger(ag) || hg < 0 || ag < 0 || hg > 99 || ag > 99)) { setErr(t.errInvalid); return }
    const when = form.when ? new Date(form.when) : null
    if (when && Number.isNaN(when.getTime())) { setErr(t.errInvalid); return }
    setBusy(true); setErr('')
    const r = await saveLeagueFixture({
      id: form.id, seasonId, matchday: md, homeTeamId: Number(form.home), awayTeamId: Number(form.away),
      kickoff: when ? when.toISOString() : null, venue: form.venue || null, status: form.status,
      homeGoals: form.status === 'played' ? hg : null, awayGoals: form.status === 'played' ? ag : null,
    })
    setBusy(false)
    if (r.error) { setErr(errText(r.error)); return }
    setForm(null); setMatchday(md); await loadFixtures(seasonId)
  }
  const removeMatch = async (f: LeagueFixture) => {
    if (!window.confirm(t.confirmDeleteMatch)) return
    const r = await deleteLeagueFixture(f.id)
    if (r.error) { window.alert(errText(r.error)); return }
    await loadFixtures(seasonId)
  }

  const submitSeason = async () => {
    const name = seasonForm.name.trim()
    if (name.length < 2) { setErr(t.errInvalid); return }
    setBusy(true); setErr('')
    const r = await createLeagueSeason({ name, startsOn: seasonForm.startsOn || null, endsOn: seasonForm.endsOn || null, makeCurrent: seasonForm.makeCurrent || seasons.length === 0 })
    setBusy(false)
    if (r.error) { setErr(errText(r.error)); return }
    setSeasonOpen(false); setSeasonForm({ name: '', startsOn: '', endsOn: '', makeCurrent: true })
    await loadSeasons(r.id)
  }
  const makeCurrent = async () => {
    if (!season) return
    const r = await setCurrentLeagueSeason(season.id)
    if (r.error) { window.alert(errText(r.error)); return }
    await loadSeasons(season.id)
  }
  const removeSeason = async () => {
    if (!season || !window.confirm(t.confirmDeleteSeason.replace('{name}', season.name))) return
    const r = await deleteLeagueSeason(season.id)
    if (r.error) { window.alert(errText(r.error)); return }
    setSeasonId(null); await loadSeasons()
  }

  const teamSelect = (value: string, onChange: (v: string) => void, id: string) => (
    <SelectField id={id} value={value} onChange={onChange} title={t.chooseClub} placeholder={t.chooseClub}
      options={[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(x => ({ value: String(x.id), label: x.name }))} />
  )

  const side = (id: number, align: 'start' | 'end') => {
    const x = teamById.get(id)
    return (
      <div className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-start ${align === 'end' ? 'sm:flex-row-reverse sm:text-end' : ''}`}>
        <ClubMark team={x} src={logoUrl(x ?? null)} />
        <span className={`min-w-0 text-[13px] sm:text-[15px] font-black leading-tight line-clamp-2 break-words ${id === myTeamId ? 'text-[#f6c744]' : ''}`}>{x?.name || '—'}</span>
      </div>
    )
  }

  const card = (f: LeagueFixture, i: number) => {
    const mine = myTeamId != null && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId)
    const played = f.status === 'played'
    const d = f.kickoff ? new Date(f.kickoff) : null
    return (
      <li key={f.id} style={{ animationDelay: `${i * 50}ms` }}
        className={`relative rounded-2xl border bg-gradient-to-br from-[#15294d] to-[#0c1730] px-4 py-4 sm:px-6 text-white shadow-[0_10px_24px_rgba(2,8,23,.35)] animate-[fadeUp_0.4s_ease-out_both] ${mine ? 'border-[#f6c744]/60' : 'border-[rgba(var(--line-rgb),.22)]'}`}>
        <div className="flex items-center gap-3 sm:gap-6">
          {side(f.homeTeamId, 'start')}
          <div className="shrink-0 w-24 sm:w-32 text-center">
            {played ? (
              <p className="text-2xl sm:text-3xl font-black tabular-nums leading-none" dir="ltr">{f.homeGoals} <span className="text-white/40">–</span> {f.awayGoals}</p>
            ) : f.status === 'postponed' ? (
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff9aa6]">{t.statusPostponed}</p>
            ) : d ? (
              <p className="text-xl sm:text-2xl font-black tabular-nums leading-none" dir="ltr">{timeFmt.format(d)}</p>
            ) : (
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/50">{t.dateTbd}</p>
            )}
            {d && <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/60">{dateFmt.format(d)}</p>}
          </div>
          {side(f.awayTeamId, 'end')}
        </div>
        {(() => {
          const ev = events.filter(e => e.fixtureId === f.id)
          if (!ev.length) return null
          const col = (id: number) => ev.filter(e => e.teamId === id && e.kind !== 'assist')
          const line = (id: number, end: boolean) => (
            <ul className={`min-w-0 flex-1 space-y-0.5 text-[11px] text-white/75 ${end ? 'text-end' : ''}`}>
              {col(id).map(e => <li key={e.id} className="truncate"><span aria-hidden>{KIND_ICON[e.kind]}</span> {e.playerName}{e.minute != null && <span className="text-white/50" dir="ltr"> {e.minute}&apos;</span>}</li>)}
            </ul>
          )
          return <div className="mt-3 flex gap-4 border-t border-white/10 pt-2.5">{line(f.homeTeamId, false)}{line(f.awayTeamId, true)}</div>
        })()}
        {(f.venue || admin) && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-[11px] text-white/55">
            <span className="truncate">{f.venue || ''}</span>
            {admin && (
              <span className="flex items-center gap-1 shrink-0">
                <button onClick={() => setSheetId(f.id)} title={t.matchSheet} aria-label={t.matchSheet} className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white"><ClipboardList size={13} /></button>
                <button onClick={() => openEdit(f)} title={t.edit} aria-label={t.edit} className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white"><Pencil size={13} /></button>
                <button onClick={() => void removeMatch(f)} title={t.confirmDeleteMatch} aria-label={t.confirmDeleteMatch} className="p-1.5 rounded-lg hover:bg-[#e3062c]/80 hover:text-white"><Trash2 size={13} /></button>
              </span>
            )}
          </div>
        )}
      </li>
    )
  }

  const genPlan = useMemo(() => {
    const n = teams.length
    if (n < 2) return { days: 0, matches: 0 }
    const per = n % 2 ? n : n - 1
    return { days: gen.double ? per * 2 : per, matches: gen.double ? n * (n - 1) : (n * (n - 1)) / 2 }
  }, [teams.length, gen.double])
  const submitGenerate = async () => {
    if (seasonId == null) return
    if (fixtures.length > 0) { setErr(t.genNeedsEmpty); return }
    const every = Number(gen.every)
    if (gen.start && (!Number.isInteger(every) || every < 1 || every > 60 || !/^\d{2}:\d{2}$/.test(gen.time))) { setErr(t.errInvalid); return }
    const rows = generateRoundRobin(teams.map(x => x.id), { double: gen.double }).map(f => ({
      seasonId, matchday: f.matchday, homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId,
      kickoff: gen.start ? new Date(`${matchdayDate(gen.start, f.matchday, every)}T${gen.time}`).toISOString() : null,
    }))
    setBusy(true); setErr('')
    const r = await bulkCreateLeagueFixtures(rows)
    setBusy(false)
    if (r.error) { setErr(errText(r.error)); await loadFixtures(seasonId); return }
    setGenOpen(false); setMatchday(null); await loadFixtures(seasonId)
  }

  if (!loaded) return <p className="py-24 text-center text-[10px] font-black uppercase tracking-[.3em] text-[var(--c-textMid)]">{t.loading}</p>

  return (
    <div>
      {/* season bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {seasons.length > 0 && (
            <SelectField value={seasonId != null ? String(seasonId) : ''} onChange={v => setSeasonId(Number(v))} title={t.season} className="!w-auto min-w-[9rem] !py-2.5"
              options={seasons.map(x => ({ value: String(x.id), label: `${x.name}${x.isCurrent ? ` · ${t.currentWord}` : ''}` }))} />
          )}
          {admin && season && !season.isCurrent && (
            <button onClick={() => void makeCurrent()} className="px-3.5 py-2.5 rounded-xl border border-[#f6c744]/50 text-[10px] font-black uppercase tracking-[.16em] text-[#f6c744] hover:bg-[#f6c744] hover:text-[#0c1f3d] transition-all">{t.setCurrent}</button>
          )}
          {admin && season && (
            <button onClick={() => void removeSeason()} title={t.deleteSeason} aria-label={t.deleteSeason} className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.25)] text-[var(--c-textMid)] hover:border-[#e3062c] hover:text-[#ff5f72] transition-all"><Trash2 size={14} /></button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'club' && !scoped && myTeamId != null && days.length > 0 && sub === 'matchdays' && (
            <button onClick={() => setOnlyMine(v => !v)} aria-pressed={onlyMine} className={chip(onlyMine)}>{onlyMine ? t.allMatches : t.myMatches}</button>
          )}
          {admin && <button onClick={() => { setErr(''); setSeasonOpen(true) }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest hover:border-[#f6c744]/60 transition-all"><Plus size={14} />{t.newSeason}</button>}
          {admin && season && sub === 'matchdays' && teams.length >= 2 && (
            <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#f6c744]/60 text-[#f6c744] text-[10px] font-black uppercase tracking-widest hover:bg-[#f6c744] hover:text-[#0c1f3d] transition-all"><ClipboardPaste size={14} />{t.importCalendar}</button>
          )}
          {admin && season && sub === 'matchdays' && fixtures.length === 0 && teams.length >= 2 && (
            <button onClick={() => { setErr(''); setGenOpen(true) }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#f6c744]/60 text-[#f6c744] text-[10px] font-black uppercase tracking-widest hover:bg-[#f6c744] hover:text-[#0c1f3d] transition-all"><Wand2 size={14} />{t.generateFixtures}</button>
          )}
          {admin && season && sub === 'matchdays' && <button onClick={openNew} disabled={teams.length < 2} title={teams.length < 2 ? t.needTwoTeams : undefined} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-[#E30613] transition-all"><Plus size={14} />{t.addMatch}</button>}
        </div>
      </div>

      {seasons.length === 0 && (
        <div className="py-24 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><CalendarDays size={56} /><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{admin ? t.noSeasons : t.noSeasonsClub}</p></div>
      )}

      {season && !section && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t.season}>
          {([['matchdays', t.matchdays], ['standings', t.standings], ['calendar', t.calendar], ['cup', t.cup]] as const).map(([k, lab]) => (
            <button key={k} role="tab" aria-selected={sub === k} onClick={() => setSub(k)}
              className={`shrink-0 px-4 py-2.5 text-[11px] font-black uppercase tracking-[.16em] border-b-2 transition-all ${sub === k ? 'border-[#E30613] text-[var(--c-text)]' : 'border-transparent text-[var(--c-textMid)] hover:text-[var(--c-text)]'}`}>{lab}</button>
          ))}
        </div>
      )}

      {season && sub === 'standings' && <LeagueStandings teams={teams} fixtures={fixtures} logoUrl={logoUrl} myTeamId={myTeamId} />}
      {season && sub === 'calendar' && <LeagueCalendar admin={admin} season={season} teams={teams} fixtures={fixtures} myTeamId={myTeamId} onlyTeamId={scoped ? myTeamId : null} />}
      {season && sub === 'cup' && <LeagueCup admin={admin} season={season} teams={teams} logoUrl={logoUrl} myTeamId={myTeamId} onInfoSaved={() => void loadSeasons(season.id)} />}

      {season && sub === 'matchdays' && scoped && (() => {
        const now = new Date(); const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime(), nextMon = mon + 7 * 86400000
        const week = fixtures.filter(f => f.kickoff && new Date(f.kickoff).getTime() >= mon && new Date(f.kickoff).getTime() < nextMon).sort((a, b) => +new Date(a.kickoff!) - +new Date(b.kickoff!))
        const upcoming = fixtures.filter(f => f.status === 'scheduled'); const nd = upcoming.length ? Math.min(...upcoming.map(f => f.matchday)) : null
        const round = week.length ? week : fixtures.filter(f => f.matchday === nd)
        const mineAll = fixtures.filter(f => f.homeTeamId === myTeamId || f.awayTeamId === myTeamId).sort((a, b) => a.matchday - b.matchday)
        const head = 'mb-3 text-[10px] font-black uppercase tracking-[.25em] text-[#f6c744]'
        const nextMine = mineAll.find(f => f.status === 'scheduled')
        const banned = nextMine && myTeamId != null ? suspendedFor(suspensions, nextMine.id, myTeamId) : []
        return (
          <div className="space-y-8">
            {banned.length > 0 && (
              <section className="rounded-2xl border border-[#e3062c]/50 bg-[#3a0b18]/50 p-4">
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-[.25em] text-[#ff9aa6]">⛔ {t.suspendedNext}</h3>
                <ul className="space-y-1">{banned.map(b => <li key={b.memberId} className="text-sm font-bold">{b.name} <span className="font-semibold text-[#ff9aa6]">· {b.reason === 'red' ? t.suspRed : t.suspYellows}</span></li>)}</ul>
              </section>
            )}
            <section>
              <h3 className={head}>{week.length || nd == null ? t.thisWeek : `${t.nextMatchday} · ${t.matchdayN.replace('{n}', String(nd))}`}</h3>
              {round.length === 0 ? <p className="rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.3)] py-8 text-center text-sm text-[var(--c-textMid)]">{t.noMatchesWeek}</p> : <ul className="space-y-3">{round.map((f, i) => card(f, i))}</ul>}
            </section>
            <section>
              <h3 className={head}>{t.ourMatches}</h3>
              {mineAll.length === 0 ? <p className="py-8 text-center text-sm text-[var(--c-textMid)]">{t.noMatches}</p> : <ul className="space-y-3">{mineAll.map((f, i) => card(f, i))}</ul>}
            </section>
          </div>
        )
      })()}

      {season && sub === 'matchdays' && !scoped && (
        <>
          {/* matchday tabs */}
          {days.length > 0 && (
            <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t.matchdays}>
              {days.map(d => (
                <button key={d} role="tab" aria-selected={d === shownDay} onClick={() => setMatchday(d)} className={`${chip(d === shownDay)} shrink-0 tabular-nums`}>
                  {t.matchdayWord} {d}
                </button>
              ))}
            </div>
          )}

          {shownDay != null && (
            <div className="mb-4 flex items-end justify-between gap-3">
              <h3 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight">{t.matchdayN.replace('{n}', String(shownDay))}</h3>
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-[#f6c744] tabular-nums">{season.name}</p>
            </div>
          )}

          {days.length === 0 && (
            <div className="py-20 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><CalendarDays size={48} /><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{t.noMatches}</p></div>
          )}

          <ul className="space-y-3">
            {shown.map((f, i) => card(f, i))}
          </ul>
          {days.length > 0 && shown.length === 0 && <p className="py-10 text-center text-sm text-[var(--c-textMid)]">{t.noMatches}</p>}
        </>
      )}

      {/* match form */}
      {form && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
          <div role="dialog" aria-modal="true" className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setForm(null)} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
            <h3 className="mb-4 text-lg font-black uppercase tracking-tight">{form.id ? t.editMatch : t.addMatch}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label} htmlFor="fx-md">{t.matchdayWord}</label><NumberField id="fx-md" min={1} max={99} value={form.matchday} onChange={v => setForm({ ...form, matchday: v })} title={t.matchdayWord} /></div>
              <div><label className={label} htmlFor="fx-status">{t.status}</label>
                <SelectField id="fx-status" value={form.status} onChange={v => setForm({ ...form, status: v as FixtureStatus })} options={[{ value: 'scheduled', label: t.statusScheduled }, { value: 'played', label: t.statusPlayed }, { value: 'postponed', label: t.statusPostponed }]} title={t.status} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="fx-home">{t.homeTeam}</label>{teamSelect(form.home, v => setForm({ ...form, home: v }), 'fx-home')}</div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="fx-away">{t.awayTeam}</label>{teamSelect(form.away, v => setForm({ ...form, away: v }), 'fx-away')}</div>
              {form.status === 'played' && (
                <>
                  <div><label className={label} htmlFor="fx-hg">{t.scoreWord} · {t.homeTeam}</label><NumberField id="fx-hg" min={0} max={99} value={form.hg} onChange={v => setForm({ ...form, hg: v })} title={`${t.scoreWord} · ${t.homeTeam}`} allowEmpty /></div>
                  <div><label className={label} htmlFor="fx-ag">{t.scoreWord} · {t.awayTeam}</label><NumberField id="fx-ag" min={0} max={99} value={form.ag} onChange={v => setForm({ ...form, ag: v })} title={`${t.scoreWord} · ${t.awayTeam}`} allowEmpty /></div>
                </>
              )}
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="fx-when">{t.dateTime}</label><DateTimeField id="fx-when" value={form.when} onChange={v => setForm({ ...form, when: v })} title={t.dateTime} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="fx-venue">{t.venue}</label><input id="fx-venue" maxLength={120} value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className={input} /></div>
            </div>
            {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button onClick={() => void submitMatch()} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* generate fixtures */}
      {genOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setGenOpen(false)}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setGenOpen(false)} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
            <h3 className="mb-1 text-lg font-black uppercase tracking-tight">{t.genTitle}</h3>
            <p className="mb-4 text-sm text-[var(--c-textMid)]">{t.genClubs.replace('{n}', String(teams.length))}</p>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1" checked={gen.double} onChange={e => setGen({ ...gen, double: e.target.checked })} />{t.genDouble}</label>
              {teams.length % 2 === 1 && <p className="text-xs text-[var(--c-textMid)]">{t.genOdd}</p>}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1"><label className={label} htmlFor="gn-start">{t.genStart}</label><DateField id="gn-start" value={gen.start} onChange={v => setGen({ ...gen, start: v })} title={t.genStart} /></div>
                <div><label className={label} htmlFor="gn-every">{t.genEvery}</label><NumberField id="gn-every" min={1} max={60} value={gen.every} onChange={v => setGen({ ...gen, every: v })} title={t.genEvery} disabled={!gen.start} /></div>
                <div><label className={label} htmlFor="gn-time">{t.genTime}</label><TimeField id="gn-time" value={gen.time} onChange={v => setGen({ ...gen, time: v })} title={t.genTime} disabled={!gen.start} /></div>
              </div>
              <p className="rounded-xl bg-[#f6c744]/10 px-3.5 py-2.5 text-sm font-bold text-[#f6c744]">{t.genPreview.replace('{matches}', String(genPlan.matches)).replace('{days}', String(genPlan.days))}</p>
            </div>
            {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setGenOpen(false)} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button onClick={() => void submitGenerate()} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">{busy ? '…' : t.genCreate}</button>
            </div>
          </div>
        </div>
      )}

      {sheetId != null && (() => {
        const f = fixtures.find(x => x.id === sheetId)
        if (!f) return null
        return <LeagueMatchSheet fixture={f} home={teamById.get(f.homeTeamId)} away={teamById.get(f.awayTeamId)} roster={roster}
          lineup={lineups.filter(l => l.fixtureId === f.id)} events={events.filter(e => e.fixtureId === f.id)}
          suspensions={[...suspendedFor(suspensions, f.id, f.homeTeamId), ...suspendedFor(suspensions, f.id, f.awayTeamId)]}
          logoUrl={logoUrl} onChanged={() => void loadFixtures(seasonId)} onClose={() => setSheetId(null)} />
      })()}

      {importOpen && season && (
        <LeagueImport seasonId={season.id} seasonYear={Number((season.startsOn || '').slice(0, 4)) || new Date().getFullYear()} seasonMonth={Number((season.startsOn || '').slice(5, 7)) || 1} teams={teams}
          existing={fixtures.length} played={fixtures.filter(f => f.status === 'played').length}
          onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); setMatchday(null); void loadFixtures(season.id) }} />
      )}

      {/* season form */}
      {seasonOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSeasonOpen(false)}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSeasonOpen(false)} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
            <h3 className="mb-4 text-lg font-black uppercase tracking-tight">{t.newSeason}</h3>
            <div className="space-y-3">
              <div><label className={label} htmlFor="se-name">{t.seasonName}</label><input id="se-name" maxLength={40} value={seasonForm.name} onChange={e => setSeasonForm({ ...seasonForm, name: e.target.value })} placeholder="2026/27" className={input} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label} htmlFor="se-from">{t.startsOn}</label><DateField id="se-from" value={seasonForm.startsOn} onChange={v => setSeasonForm({ ...seasonForm, startsOn: v })} title={t.startsOn} /></div>
                <div><label className={label} htmlFor="se-to">{t.endsOn}</label><DateField id="se-to" value={seasonForm.endsOn} onChange={v => setSeasonForm({ ...seasonForm, endsOn: v })} title={t.endsOn} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={seasonForm.makeCurrent || seasons.length === 0} disabled={seasons.length === 0} onChange={e => setSeasonForm({ ...seasonForm, makeCurrent: e.target.checked })} />{t.makeCurrent}</label>
            </div>
            {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setSeasonOpen(false)} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button onClick={() => void submitSeason()} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
