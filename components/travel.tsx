'use client'
// Passport validity, birthdays / age-group eligibility, and trip logistics.
// Pure rules live in lib/documents.ts and lib/eligibility.ts (unit-tested);
// who may read or write each table is decided by RLS (migrations/0010).
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '@/lib/language-context'
import { DatePicker } from '@/components/pickers'
import { AGE_LIMITS, eligibilityFor, upcomingBirthdays } from '@/lib/eligibility'
import { passportStatus, MIN_VALID_MONTHS, type PassportStatus } from '@/lib/documents'
import {
  EMPTY_TRIP_PLAN, fetchTripMembers, fetchTripPlan, savePassportExpiry, saveTripMember, saveTripPlan,
  type TicketStatus, type TripEvent, type TripMember, type TripPlan, type VisaStatus,
} from '@/lib/app-data'

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
export const todayIso = () => new Date().toISOString().slice(0, 10)

export type Person = { id: number; name: string; birthdate?: string | null; teamCategory?: string }

const CARD = 'bg-white rounded-xl border border-zinc-100 p-3 shadow-sm'
const LABEL = 'text-[7px] font-black uppercase tracking-wider text-zinc-400'
const INPUT = 'w-full px-3 py-2 rounded-xl border border-[rgba(var(--line-rgb),.18)] bg-[var(--c-surface)] text-[var(--c-text)] text-xs font-bold outline-none focus:border-[#E30613]/50'
const FIELD_LABEL = 'block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5'

const statusTone = (s: PassportStatus['status']) =>
  s === 'ok' ? 'bg-emerald-500/10 text-emerald-700'
  : s === 'short' ? 'bg-[#f6c744]/20 text-[#a9822e]'
  : 'bg-[#e3062c]/10 text-[#E30613]'

// ── Passport expiry, shown in the player's profile ─────────────────────
export function PassportCard({ memberId, expiry, canEdit, onSaved }: {
  memberId: number; expiry: string; canEdit: boolean; onSaved: (v: string) => void
}) {
  const { tr } = useTranslate()
  const [draft, setDraft] = useState(expiry)
  const [msg, setMsg] = useState('')
  useEffect(() => { setDraft(expiry); setMsg('') }, [expiry, memberId])
  const st = passportStatus(draft, todayIso())
  const label =
    st.status === 'missing' ? tr.travel.passportMissing
    : st.status === 'expired' ? tr.travel.expired
    : st.status === 'short' ? fill(tr.travel.shortLeft, { n: st.daysLeft })
    : fill(tr.travel.validUntil, { d: draft })

  const save = async () => {
    const { error } = await savePassportExpiry(memberId, draft || null)
    if (error) return setMsg(tr.travel.saveError)
    onSaved(draft); setMsg(tr.travel.saved)
  }
  return (
    <div className="rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-deep)] p-3 space-y-2">
      <p className={FIELD_LABEL}>{tr.travel.passportTitle}</p>
      <span className={`inline-block px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${statusTone(st.status)}`}>{label}</span>
      {canEdit ? (
        <div className="flex items-center gap-2">
          <div className="flex-1"><DatePicker value={draft} onChange={setDraft} placeholder={tr.travel.passportExpiry}
            minYear={new Date().getFullYear() - 5} maxYear={new Date().getFullYear() + 15} /></div>
          <button type="button" onClick={save} disabled={draft === expiry}
            className="px-3 py-2 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40">{tr.travel.save}</button>
        </div>
      ) : (
        <p className="text-[10px] font-semibold text-[var(--c-textDim)]">{tr.travel.noPermission}</p>
      )}
      {msg && <p className="text-[9px] font-black uppercase tracking-wider text-[var(--c-textDim)]">{msg}</p>}
    </div>
  )
}

// ── Dashboard: who has a passport problem ──────────────────────────────
export function TravelAlertsCard({ people, expiries }: { people: Person[]; expiries: Record<number, string> }) {
  const { tr } = useTranslate()
  const today = todayIso()
  const rows = useMemo(() => people.map(p => ({ p, st: passportStatus(expiries[p.id], today) })), [people, expiries, today])
  const expired = rows.filter(r => r.st.status === 'expired').sort((a, b) => (a.st as any).daysLeft - (b.st as any).daysLeft)
  const short = rows.filter(r => r.st.status === 'short').sort((a, b) => (a.st as any).daysLeft - (b.st as any).daysLeft)
  const missing = rows.filter(r => r.st.status === 'missing')
  const clean = !expired.length && !short.length && !missing.length
  const chip = (cls: string, text: string) => <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>{text}</span>
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-2">
        <p className={LABEL}>{tr.travel.alertsTitle}</p>
        <div className="flex items-center gap-1.5">
          {chip('bg-[#e3062c]/10 text-[#E30613]', `${expired.length} ${tr.travel.expiredLabel}`)}
          {chip('bg-[#f6c744]/15 text-[#a9822e]', `${short.length} < 6m`)}
        </div>
      </div>
      {clean ? <p className="text-[10px] text-zinc-400 py-2 text-center">{tr.travel.alertsEmpty}</p> : (
        <div className="space-y-1">
          {[...expired, ...short].map(({ p, st }) => (
            <div key={p.id} className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-zinc-700">{p.name}</span>
              {chip(statusTone(st.status), st.status === 'expired' ? tr.travel.expiredLabel : fill(tr.travel.daysLeft, { n: (st as any).daysLeft }))}
            </div>
          ))}
          {missing.length > 0 && (
            <p className="pt-1.5 text-[10px] text-zinc-500"><span className="font-black uppercase tracking-wider text-[8px] text-zinc-400">{tr.travel.missingLabel} ({missing.length}): </span>
              {missing.map(r => r.p.name).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dashboard: birthdays and age-group eligibility ─────────────────────
export function BirthdaysEligibilityCard({ people, category }: { people: Person[]; category: string }) {
  const { tr } = useTranslate()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const birthdays = useMemo(() => upcomingBirthdays(people, new Date(), 30), [people])
  const limit = AGE_LIMITS[category]
  const elig = useMemo(() => limit === undefined ? [] : people.map(p => ({ p, e: eligibilityFor(p.birthdate, category, year) })), [people, category, year, limit])
  const over = elig.filter(x => x.e.status === 'over')
  const ageing = elig.filter(x => x.e.status === 'ageing_out')
  const unknown = elig.filter(x => x.e.status === 'unknown')
  return (
    <div className={`${CARD} space-y-3`}>
      <div>
        <p className={`${LABEL} mb-2`}>{tr.travel.birthdaysTitle}</p>
        {birthdays.length === 0 ? <p className="text-[10px] text-zinc-400">{tr.travel.noBirthdays}</p> : (
          <div className="space-y-1">
            {birthdays.slice(0, 8).map(b => (
              <div key={b.id} className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-zinc-700">{b.name} <span className="font-semibold text-zinc-400">· {fill(tr.travel.turns, { n: b.turning })}</span></span>
                <span className={`text-[9px] font-black uppercase tracking-wider ${b.daysAway === 0 ? 'text-[#E30613]' : 'text-zinc-400'}`}>
                  {b.daysAway === 0 ? tr.travel.today : fill(tr.travel.inDays, { n: b.daysAway })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {limit !== undefined && (
        <div className="border-t border-zinc-100 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className={LABEL}>{tr.travel.eligibilityTitle} · U-{limit}</p>
            <label className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-zinc-400">{tr.travel.tournamentYear}
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-1.5 py-1 rounded-md border border-zinc-200 bg-white text-[10px] font-bold text-zinc-700">
                {Array.from({ length: 6 }, (_, i) => thisYear + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          {over.length === 0 && ageing.length === 0 && unknown.length === 0 && <p className="text-[10px] text-zinc-400">{tr.travel.allEligible}</p>}
          {[{ list: over, label: tr.travel.overAge, cls: 'bg-[#e3062c]/10 text-[#E30613]' }, { list: ageing, label: tr.travel.ageingOut, cls: 'bg-[#f6c744]/15 text-[#a9822e]' }].map(g => g.list.map(({ p, e }) => (
            <div key={`${g.label}${p.id}`} className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-zinc-700">{p.name} <span className="font-semibold text-zinc-400">· {fill(tr.travel.ageInYear, { n: (e as any).ageInYear, y: year })}</span></span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${g.cls}`}>{g.label}</span>
            </div>
          )))}
          {unknown.length > 0 && <p className="text-[10px] text-zinc-500"><span className="font-black uppercase tracking-wider text-[8px] text-zinc-400">{tr.travel.noBirthdate} ({unknown.length}): </span>{unknown.map(x => x.p.name).join(', ')}</p>}
          <p className="text-[9px] text-zinc-400 leading-snug">{tr.travel.ruleNote}</p>
        </div>
      )}
    </div>
  )
}

// ── Trip logistics for one camp or match ───────────────────────────────
const VISA: VisaStatus[] = ['unknown', 'not_needed', 'to_apply', 'applied', 'approved', 'refused']
const TICKET: TicketStatus[] = ['pending', 'booked']

export function TripPanel({ type, eventId, startIso, endIso, people, canManage, expiries, hideWhenEmpty }: {
  /** render nothing (instead of a notice) when there is no plan and nothing to edit */
  hideWhenEmpty?: boolean
  type: TripEvent; eventId: number; startIso: string; endIso: string
  people: Person[]; canManage: boolean
  /** passport expiries; undefined when the viewer may not see them */
  expiries?: Record<number, string>
}) {
  const { tr } = useTranslate()
  const [plan, setPlan] = useState<TripPlan>(EMPTY_TRIP_PLAN)
  const [hasPlan, setHasPlan] = useState(false)
  const [rows, setRows] = useState<Record<number, TripMember>>({})
  const [msg, setMsg] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    Promise.all([fetchTripPlan(type, eventId), fetchTripMembers(type, eventId)]).then(([p, ms]) => {
      if (!alive) return
      setPlan(p || EMPTY_TRIP_PLAN); setHasPlan(!!p)
      setRows(Object.fromEntries(ms.map(m => [m.member_id, m]))); setLoaded(true)
    })
    return () => { alive = false }
  }, [type, eventId])

  const visaLabel: Record<VisaStatus, string> = {
    unknown: tr.travel.visaUnknown, not_needed: tr.travel.visaNotNeeded, to_apply: tr.travel.visaToApply,
    applied: tr.travel.visaApplied, approved: tr.travel.visaApproved, refused: tr.travel.visaRefused,
  }
  const ticketLabel: Record<TicketStatus, string> = { pending: tr.travel.ticketPending, booked: tr.travel.ticketBooked }
  const rowOf = (id: number): TripMember => rows[id] || { member_id: id, visa_status: 'unknown', ticket_status: 'pending', room: '', notes: '' }
  const flash = (err: string | null) => { setMsg(err ? tr.travel.saveError : tr.travel.saved); setTimeout(() => setMsg(''), 2500) }

  const savePlan = async () => { const { error } = await saveTripPlan(type, eventId, plan); if (!error) setHasPlan(true); flash(error) }
  const patchRow = async (id: number, patch: Partial<TripMember>) => {
    const next = { ...rowOf(id), ...patch }
    setRows(r => ({ ...r, [id]: next }))
    const { error } = await saveTripMember(type, eventId, next)
    flash(error)
  }
  const setP = (k: keyof TripPlan, v: string) => setPlan(p => ({ ...p, [k]: v === '' && (k.endsWith('date') || k.startsWith('check')) ? null : v }))

  // A passport must be valid 6 months past the day the team gets back.
  const returnRef = plan.return_date || endIso || startIso
  const text = (k: keyof TripPlan, label: string) => (
    <div><label className={FIELD_LABEL}>{label}</label>
      <input value={(plan[k] as string) || ''} readOnly={!canManage} onChange={e => setP(k, e.target.value)} className={INPUT} /></div>
  )
  const date = (k: keyof TripPlan, label: string) => (
    <div><label className={FIELD_LABEL}>{label}</label>
      {canManage ? <DatePicker value={(plan[k] as string) || ''} onChange={v => setP(k, v)} placeholder={label} />
        : <p className="text-xs font-bold text-[var(--c-text)]">{(plan[k] as string) || '—'}</p>}</div>
  )

  if (!loaded) return null
  if (!canManage && !hasPlan && !Object.keys(rows).length) return hideWhenEmpty ? null : <p className="text-[11px] font-semibold text-[var(--c-textDim)] py-4">{tr.travel.tripEmpty}</p>

  return (
    <div className="space-y-5">
      {!canManage && <p className="text-[10px] font-semibold text-[var(--c-textDim)]">{tr.travel.readOnlyNote}</p>}
      {(canManage || hasPlan) && (
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--c-text)]">{tr.travel.tripPlan}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {date('depart_date', tr.travel.departDate)}{date('return_date', tr.travel.returnDate)}
            {text('depart_from', tr.travel.departFrom)}{text('arrive_to', tr.travel.arriveTo)}
            {text('flight_info', tr.travel.flightInfo)}{text('return_info', tr.travel.returnInfo)}
            {text('hotel_name', tr.travel.hotelName)}{text('hotel_address', tr.travel.hotelAddress)}
            {date('check_in', tr.travel.checkIn)}{date('check_out', tr.travel.checkOut)}
          </div>
          {text('notes', tr.travel.notes)}
          {canManage && <button type="button" onClick={savePlan} className="px-4 py-2 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider">{tr.travel.save}</button>}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--c-text)]">{canManage ? tr.travel.people : tr.travel.myTrip}</h3>
        {people.length === 0 && <p className="text-[11px] font-semibold text-[var(--c-textDim)]">{tr.travel.noPeople}</p>}
        <div className="space-y-2">
          {people.filter(p => canManage || rows[p.id]).map(p => {
            const r = rowOf(p.id)
            const ps = expiries ? passportStatus(expiries[p.id], returnRef, MIN_VALID_MONTHS) : null
            return (
              <div key={p.id} className="rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-deep)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[var(--c-text)]">{p.name}</span>
                  {ps && <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${statusTone(ps.status)}`}>
                    {tr.travel.passport}: {ps.status === 'missing' ? tr.travel.missingLabel : ps.status === 'expired' ? tr.travel.expiredLabel : ps.status === 'short' ? tr.travel.shortLabel : 'OK'}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={FIELD_LABEL}>{tr.travel.visa}</label>
                    <select disabled={!canManage} value={r.visa_status} onChange={e => patchRow(p.id, { visa_status: e.target.value as VisaStatus })} className={INPUT}>
                      {VISA.map(v => <option key={v} value={v}>{visaLabel[v]}</option>)}</select></div>
                  <div><label className={FIELD_LABEL}>{tr.travel.ticket}</label>
                    <select disabled={!canManage} value={r.ticket_status} onChange={e => patchRow(p.id, { ticket_status: e.target.value as TicketStatus })} className={INPUT}>
                      {TICKET.map(v => <option key={v} value={v}>{ticketLabel[v]}</option>)}</select></div>
                  <div><label className={FIELD_LABEL}>{tr.travel.room}</label>
                    <input readOnly={!canManage} defaultValue={r.room} key={`${p.id}-${r.room}`} onBlur={e => { if (canManage && e.target.value !== r.room) patchRow(p.id, { room: e.target.value }) }} className={INPUT} /></div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      {msg && <p className="text-[9px] font-black uppercase tracking-wider text-[var(--c-textDim)]">{msg}</p>}
    </div>
  )
}
