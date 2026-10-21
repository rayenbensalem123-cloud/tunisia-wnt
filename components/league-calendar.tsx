'use client'
// Month view of the season: league matches, cup matches, season start/end and breaks.
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import {
  fetchLeagueCupMatches, fetchLeagueBreaks, createLeagueBreak, deleteLeagueBreak,
  type LeagueTeam, type LeagueSeason, type LeagueFixture, type LeagueCupMatch, type LeagueBreak, type FixtureError,
} from '@/lib/app-data'
import { input, label } from '@/components/league-ui'
import { DateField } from '@/components/league-pickers'

type Props = { admin: boolean; season: LeagueSeason; teams: LeagueTeam[]; fixtures: LeagueFixture[]; myTeamId: number | null; /** Team page: show only this club's matches. */ onlyTeamId?: number | null }

type Item = { key: string; kind: 'league' | 'cup'; time: string | null; home: string; away: string; score: string | null; mine: boolean }

const pad = (n: number) => String(n).padStart(2, '0')
/** Local calendar day of an ISO timestamp, as YYYY-MM-DD. */
const dayOf = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export function LeagueCalendar({ admin, season, teams, fixtures, myTeamId, onlyTeamId = null }: Props) {
  const { tr, lang } = useTranslate()
  const t = tr.league
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB'
  const [cup, setCup] = useState<LeagueCupMatch[]>([])
  const [breaks, setBreaks] = useState<LeagueBreak[]>([])
  const start = season.startsOn ? new Date(season.startsOn + 'T00:00:00') : null
  const firstMatch = useMemo(() => fixtures.map(f => f.kickoff).filter(Boolean).sort()[0] ?? null, [fixtures])
  // Open on the current month while the season is running, otherwise on its first month.
  const nowD = new Date()
  const end = season.endsOn ? new Date(season.endsOn + 'T23:59:59') : null
  const running = (!start || nowD >= start) && (!end || nowD <= end)
  const initial = running ? nowD : (start ?? (firstMatch ? new Date(firstMatch) : nowD))
  const [cursor, setCursor] = useState({ y: initial.getFullYear(), m: initial.getMonth() })
  const [picked, setPicked] = useState<string | null>(null)
  const [form, setForm] = useState<{ title: string; startsOn: string; endsOn: string } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [c, b] = await Promise.all([fetchLeagueCupMatches(season.id), fetchLeagueBreaks(season.id)])
    setCup(c); setBreaks(b)
  }
  useEffect(() => { void load(); setPicked(null) }, [season.id])

  const name = (id: number | null) => teams.find(x => x.id === id)?.name ?? '—'
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale])
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale])
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }), [locale])
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))) // Monday first
  }, [locale])

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>()
    const add = (day: string, it: Item) => map.set(day, [...(map.get(day) ?? []), it])
    const mineOnly = (a: number | null, b: number | null) => onlyTeamId == null || a === onlyTeamId || b === onlyTeamId
    for (const f of fixtures) {
      if (!f.kickoff || !mineOnly(f.homeTeamId, f.awayTeamId)) continue
      add(dayOf(f.kickoff), { key: `l${f.id}`, kind: 'league', time: timeFmt.format(new Date(f.kickoff)), home: name(f.homeTeamId), away: name(f.awayTeamId), score: f.status === 'played' ? `${f.homeGoals}–${f.awayGoals}` : f.status === 'postponed' ? t.statusPostponed : null, mine: myTeamId != null && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId) })
    }
    for (const c of cup) {
      if (!c.kickoff || !mineOnly(c.homeTeamId, c.awayTeamId)) continue
      add(dayOf(c.kickoff), { key: `c${c.id}`, kind: 'cup', time: timeFmt.format(new Date(c.kickoff)), home: c.homeTeamId ? name(c.homeTeamId) : t.tbd, away: c.awayTeamId ? name(c.awayTeamId) : t.tbd, score: c.status === 'played' ? `${c.homeGoals}–${c.awayGoals}` : c.status === 'postponed' ? t.statusPostponed : null, mine: myTeamId != null && (c.homeTeamId === myTeamId || c.awayTeamId === myTeamId) })
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtures, cup, teams, myTeamId, onlyTeamId, timeFmt, t])

  const inBreak = (day: string) => breaks.find(b => day >= b.startsOn && day <= b.endsOn)
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const lead = (first.getDay() + 6) % 7 // Monday first
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)]
  }, [cursor])
  const shift = (n: number) => setCursor(c => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const today = (() => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()) })()

  const errText = (e: FixtureError | null) => ({ invalid: t.errInvalid, denied: t.errDenied } as Record<string, string>)[e || ''] ?? t.errGeneric
  const submitBreak = async () => {
    if (!form) return
    if (form.title.trim().length < 2 || !form.startsOn || !form.endsOn || form.startsOn > form.endsOn) { setErr(t.errInvalid); return }
    setBusy(true); setErr('')
    const r = await createLeagueBreak({ seasonId: season.id, ...form })
    setBusy(false)
    if (r.error) { setErr(errText(r.error)); return }
    setForm(null); await load()
  }
  const removeBreak = async (b: LeagueBreak) => {
    if (!window.confirm(t.confirmDeleteBreak)) return
    const r = await deleteLeagueBreak(b.id)
    if (r.error) { window.alert(errText(r.error)); return }
    await load()
  }

  const pickedItems = picked ? byDay.get(picked) ?? [] : []
  const pickedBreak = picked ? inBreak(picked) : undefined

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} aria-label={t.prevMonth} className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.25)] hover:border-[#f6c744]/60"><ChevronLeft size={16} className="rtl:rotate-180" /></button>
          <h3 className="min-w-[10rem] text-center text-xl font-black italic uppercase tracking-tight">{monthFmt.format(new Date(cursor.y, cursor.m, 1))}</h3>
          <button onClick={() => shift(1)} aria-label={t.nextMonth} className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.25)] hover:border-[#f6c744]/60"><ChevronRight size={16} className="rtl:rotate-180" /></button>
        </div>
        {admin && <button onClick={() => { setErr(''); setForm({ title: '', startsOn: '', endsOn: '' }) }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[12px] font-black uppercase tracking-widest hover:border-[#f6c744]/60"><Plus size={14} />{t.addBreak}</button>}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={monthFmt.format(new Date(cursor.y, cursor.m, 1))}>
        {weekdays.map(w => <div key={w} className="pb-1 text-center text-[12px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)]">{w}</div>)}
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />
          const day = ymd(cursor.y, cursor.m, d)
          const items = byDay.get(day) ?? []
          const br = inBreak(day)
          const isStart = season.startsOn === day, isEnd = season.endsOn === day
          const leagueN = items.filter(x => x.kind === 'league').length, cupN = items.length - leagueN
          return (
            <button key={day} onClick={() => setPicked(day === picked ? null : day)} aria-pressed={picked === day}
              className={`relative min-h-[64px] sm:min-h-[84px] rounded-xl p-1.5 text-start text-white transition-all ring-1 ring-inset
                ${picked === day ? 'ring-[#f6c744] bg-[#f6c744]/15' : br ? 'ring-white/10 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.05)_0_6px,transparent_6px_12px)]' : 'ring-white/10 bg-[#101f3d] hover:ring-[#f6c744]/50'}`}>
              <span className={`text-xs font-black tabular-nums ${day === today ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E30613] px-1' : 'text-white/80'}`}>{d}</span>
              {(isStart || isEnd) && <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-[#f6c744]" title={isStart ? t.seasonStarts : t.seasonEnds} />}
              <span className="mt-1 flex flex-wrap gap-1">
                {leagueN > 0 && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-black ${items.some(x => x.mine && x.kind === 'league') ? 'bg-[#f6c744] text-[#0c1f3d]' : 'bg-white/15'}`}>{leagueN}</span>}
                {cupN > 0 && <span className="rounded-md bg-[#E30613] px-1.5 py-0.5 text-[11px] font-black">{t.cup} {cupN}</span>}
              </span>
              {br && <span className="mt-1 hidden truncate text-[11px] font-bold text-white/55 sm:block">{br.title}</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--c-textMid)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/40" />{t.leagueLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E30613]" />{t.cup}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f6c744]" />{t.seasonStarts} / {t.seasonEnds}</span>
      </div>

      {picked && (
        <section className="mt-5 rounded-2xl border border-[rgba(var(--line-rgb),.22)] bg-gradient-to-br from-[#15294d] to-[#0c1730] p-4 sm:p-5 text-white">
          <h4 className="mb-3 text-sm font-black uppercase tracking-[.12em]">{dayFmt.format(new Date(picked + 'T00:00:00'))}</h4>
          {pickedBreak && <p className="mb-2 text-sm font-semibold text-white/70">{pickedBreak.title}</p>}
          {season.startsOn === picked && <p className="mb-2 text-sm font-semibold text-[#f6c744]">{t.seasonStarts}</p>}
          {season.endsOn === picked && <p className="mb-2 text-sm font-semibold text-[#f6c744]">{t.seasonEnds}</p>}
          {pickedItems.length === 0 && !pickedBreak && season.startsOn !== picked && season.endsOn !== picked && <p className="text-sm text-white/60">{t.noEventsDay}</p>}
          <ul className="space-y-2">
            {pickedItems.map(it => (
              <li key={it.key} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ${it.mine ? 'ring-[#f6c744]/60 bg-[#f6c744]/10' : 'ring-white/10 bg-white/[.04]'}`}>
                <span className="min-w-0 truncate text-sm font-bold">{it.home} <span className="text-white/40">–</span> {it.away}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-black tabular-nums">
                  {it.kind === 'cup' && <span className="rounded bg-[#E30613] px-1.5 py-0.5 text-[11px]">{t.cup}</span>}
                  <span dir="ltr">{it.score ?? it.time}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {breaks.length > 0 && (
        <section className="mt-6">
          <h4 className={label}>{t.breaksWord}</h4>
          <ul className="space-y-2">
            {breaks.map(b => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(var(--line-rgb),.22)] bg-[var(--c-deep)] px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate font-bold">{b.title}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-[var(--c-textMid)] tabular-nums" dir="ltr">
                  {new Date(b.startsOn + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – {new Date(b.endsOn + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {admin && <button onClick={() => void removeBreak(b)} aria-label={t.confirmDeleteBreak} className="p-1.5 rounded-lg hover:bg-[#e3062c]/80 hover:text-white"><Trash2 size={13} /></button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {form && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setForm(null)} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
            <h3 className="mb-4 text-lg font-black uppercase tracking-tight">{t.addBreak}</h3>
            <div className="space-y-3">
              <div><label className={label} htmlFor="br-title">{t.breakTitle}</label><input id="br-title" maxLength={80} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={input} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label} htmlFor="br-from">{t.breakFrom}</label><DateField id="br-from" value={form.startsOn} onChange={v => setForm({ ...form, startsOn: v })} title={t.breakFrom} /></div>
                <div><label className={label} htmlFor="br-to">{t.breakTo}</label><DateField id="br-to" value={form.endsOn} onChange={v => setForm({ ...form, endsOn: v })} title={t.breakTo} /></div>
              </div>
            </div>
            {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[12px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button onClick={() => void submitBreak()} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[12px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
