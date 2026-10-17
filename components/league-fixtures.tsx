'use client'
// Ligue Féminine: seasons, matchdays and results.
// Admin creates seasons and matches and enters scores; a club account sees the same
// fixtures read-only, with its own matches highlighted.
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import {
  fetchLeagueSeasons, fetchLeagueFixtures, createLeagueSeason, setCurrentLeagueSeason, deleteLeagueSeason,
  saveLeagueFixture, deleteLeagueFixture,
  type LeagueTeam, type LeagueSeason, type LeagueFixture, type FixtureStatus, type FixtureError,
} from '@/lib/app-data'
import { hueOf, initialsOf } from '@/components/league-team-card'

type Props = {
  mode: 'admin' | 'club'
  /** Every club (id, name, logo). */
  teams: LeagueTeam[]
  logoUrl: (x: LeagueTeam | null) => string
  /** The club this login belongs to (club mode), highlighted in the list. */
  myTeamId: number | null
}

const input = 'w-full rounded-xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-deep)] px-3.5 py-3 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[#f6c744]/70'
const label = 'mb-1 block text-[9px] font-black uppercase tracking-[.2em] text-[var(--c-textMid)]'
const chip = (on: boolean) =>
  `px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-[.16em] transition-all ring-1 ring-inset ${on ? 'bg-[#f6c744] text-[#0c1f3d] ring-[#f6c744]' : 'text-[var(--c-textMid)] ring-[rgba(var(--line-rgb),.3)] hover:ring-[#f6c744]/60 hover:text-[var(--c-text)]'}`

/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function ClubMark({ team, src, size = 44 }: { team: LeagueTeam | undefined; src: string; size?: number }) {
  const name = team?.name || '?'
  const h = hueOf(name)
  if (src) return <img src={src} alt="" width={size} height={size} className="object-contain shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,.4)]" style={{ width: size, height: size }} />
  return (
    <svg aria-hidden viewBox="0 0 100 116" className="shrink-0" style={{ width: size * 0.9, height: size }}>
      <path d="M50 3 93 17v38c0 31-19 49-43 58C26 104 7 86 7 55V17z" fill={`hsl(${h} 45% 24%)`} stroke={`hsl(${h} 55% 62%)`} strokeWidth="4" />
      <text x="50" y="68" textAnchor="middle" fontSize={initialsOf(name).length > 2 ? 27 : 34} fontWeight="900" fill="#fff" fillOpacity=".92" fontFamily="inherit">{initialsOf(name)}</text>
    </svg>
  )
}

type FxForm = { id?: number; matchday: string; home: string; away: string; when: string; venue: string; status: FixtureStatus; hg: string; ag: string }

export function LeagueFixtures({ mode, teams, logoUrl, myTeamId }: Props) {
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
    if (id == null) { setFixtures([]); return }
    setFixtures(await fetchLeagueFixtures(id))
  }
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
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className={input}>
      <option value="">{t.chooseClub}</option>
      {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
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

  if (!loaded) return <p className="py-24 text-center text-[10px] font-black uppercase tracking-[.3em] text-[var(--c-textMid)]">{t.loading}</p>

  return (
    <div>
      {/* season bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {seasons.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">{t.season}</span>
              <select value={seasonId ?? ''} onChange={e => setSeasonId(Number(e.target.value))} className={`${input} !w-auto !py-2.5 !pe-9`} aria-label={t.season}>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? ` · ${t.currentWord}` : ''}</option>)}
              </select>
            </label>
          )}
          {admin && season && !season.isCurrent && (
            <button onClick={() => void makeCurrent()} className="px-3.5 py-2.5 rounded-xl border border-[#f6c744]/50 text-[10px] font-black uppercase tracking-[.16em] text-[#f6c744] hover:bg-[#f6c744] hover:text-[#0c1f3d] transition-all">{t.setCurrent}</button>
          )}
          {admin && season && (
            <button onClick={() => void removeSeason()} title={t.deleteSeason} aria-label={t.deleteSeason} className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.25)] text-[var(--c-textMid)] hover:border-[#e3062c] hover:text-[#ff5f72] transition-all"><Trash2 size={14} /></button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'club' && myTeamId != null && days.length > 0 && (
            <button onClick={() => setOnlyMine(v => !v)} aria-pressed={onlyMine} className={chip(onlyMine)}>{onlyMine ? t.allMatches : t.myMatches}</button>
          )}
          {admin && <button onClick={() => { setErr(''); setSeasonOpen(true) }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest hover:border-[#f6c744]/60 transition-all"><Plus size={14} />{t.newSeason}</button>}
          {admin && season && <button onClick={openNew} disabled={teams.length < 2} title={teams.length < 2 ? t.needTwoTeams : undefined} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-[#E30613] transition-all"><Plus size={14} />{t.addMatch}</button>}
        </div>
      </div>

      {seasons.length === 0 && (
        <div className="py-24 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><CalendarDays size={56} /><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{admin ? t.noSeasons : t.noSeasonsClub}</p></div>
      )}

      {season && (
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
            {shown.map((f, i) => {
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
                  {(f.venue || admin) && (
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-[11px] text-white/55">
                      <span className="truncate">{f.venue || ''}</span>
                      {admin && (
                        <span className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(f)} title={t.edit} aria-label={t.edit} className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white"><Pencil size={13} /></button>
                          <button onClick={() => void removeMatch(f)} title={t.confirmDeleteMatch} aria-label={t.confirmDeleteMatch} className="p-1.5 rounded-lg hover:bg-[#e3062c]/80 hover:text-white"><Trash2 size={13} /></button>
                        </span>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
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
              <div><label className={label} htmlFor="fx-md">{t.matchdayWord}</label><input id="fx-md" type="number" min={1} max={99} value={form.matchday} onChange={e => setForm({ ...form, matchday: e.target.value })} className={input} /></div>
              <div><label className={label} htmlFor="fx-status">{t.status}</label>
                <select id="fx-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FixtureStatus })} className={input}>
                  <option value="scheduled">{t.statusScheduled}</option><option value="played">{t.statusPlayed}</option><option value="postponed">{t.statusPostponed}</option>
                </select></div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="fx-home">{t.homeTeam}</label>{teamSelect(form.home, v => setForm({ ...form, home: v }), 'fx-home')}</div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="fx-away">{t.awayTeam}</label>{teamSelect(form.away, v => setForm({ ...form, away: v }), 'fx-away')}</div>
              {form.status === 'played' && (
                <>
                  <div><label className={label} htmlFor="fx-hg">{t.scoreWord} · {t.homeTeam}</label><input id="fx-hg" type="number" min={0} max={99} value={form.hg} onChange={e => setForm({ ...form, hg: e.target.value })} className={input} /></div>
                  <div><label className={label} htmlFor="fx-ag">{t.scoreWord} · {t.awayTeam}</label><input id="fx-ag" type="number" min={0} max={99} value={form.ag} onChange={e => setForm({ ...form, ag: e.target.value })} className={input} /></div>
                </>
              )}
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="fx-when">{t.dateTime}</label><input id="fx-when" type="datetime-local" value={form.when} onChange={e => setForm({ ...form, when: e.target.value })} className={input} /></div>
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

      {/* season form */}
      {seasonOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSeasonOpen(false)}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSeasonOpen(false)} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
            <h3 className="mb-4 text-lg font-black uppercase tracking-tight">{t.newSeason}</h3>
            <div className="space-y-3">
              <div><label className={label} htmlFor="se-name">{t.seasonName}</label><input id="se-name" maxLength={40} value={seasonForm.name} onChange={e => setSeasonForm({ ...seasonForm, name: e.target.value })} placeholder="2026/27" className={input} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label} htmlFor="se-from">{t.startsOn}</label><input id="se-from" type="date" value={seasonForm.startsOn} onChange={e => setSeasonForm({ ...seasonForm, startsOn: e.target.value })} className={input} /></div>
                <div><label className={label} htmlFor="se-to">{t.endsOn}</label><input id="se-to" type="date" value={seasonForm.endsOn} onChange={e => setSeasonForm({ ...seasonForm, endsOn: e.target.value })} className={input} /></div>
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
