'use client'
// Cup: name and description, knockout rounds as columns, admin editing.
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Trophy, X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import {
  fetchLeagueCupMatches, saveLeagueCupMatch, deleteLeagueCupMatch, saveLeagueCupInfo,
  type LeagueTeam, type LeagueSeason, type LeagueCupMatch, type CupRound, type FixtureStatus, type FixtureError,
} from '@/lib/app-data'
import { cupWinner, nextFreeSlot, roundKey } from '@/lib/league-cup'
import { ClubMark, input, label, toLocalInput } from '@/components/league-ui'

type Props = {
  admin: boolean
  season: LeagueSeason
  teams: LeagueTeam[]
  logoUrl: (x: LeagueTeam | null) => string
  myTeamId: number | null
  /** Called after the cup name or description changed, so the season list can reload. */
  onInfoSaved: () => void
}

const ROUNDS: CupRound[] = [64, 32, 16, 8, 4, 2]
type Form = { id?: number; round: string; slot: string; home: string; away: string; when: string; venue: string; status: FixtureStatus; hg: string; ag: string; hp: string; ap: string }

export function LeagueCup({ admin, season, teams, logoUrl, myTeamId, onInfoSaved }: Props) {
  const { tr, lang } = useTranslate()
  const t = tr.league
  const [matches, setMatches] = useState<LeagueCupMatch[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [info, setInfo] = useState<{ name: string; text: string } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB'
  const when = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale])
  const byId = useMemo(() => new Map(teams.map(x => [x.id, x])), [teams])

  const load = async () => setMatches(await fetchLeagueCupMatches(season.id))
  useEffect(() => { void load() }, [season.id])

  const rounds = useMemo(() => ROUNDS.filter(r => matches.some(m => m.round === r)), [matches])
  const final = matches.find(m => m.round === 2)
  const champion = final ? cupWinner(final) : null
  const errText = (e: FixtureError | null) => ({ sameTeam: t.errSameTeam, duplicate: t.errCupSlot, invalid: t.errInvalid, denied: t.errDenied } as Record<string, string>)[e || ''] ?? t.errGeneric

  const openNew = () => {
    setErr('')
    const r = rounds.length ? rounds[0] : 8
    setForm({ round: String(r), slot: String(nextFreeSlot(r, matches.filter(m => m.round === r).map(m => m.slot)) ?? 1), home: '', away: '', when: '', venue: '', status: 'scheduled', hg: '', ag: '', hp: '', ap: '' })
  }
  const openEdit = (m: LeagueCupMatch) => {
    setErr('')
    setForm({ id: m.id, round: String(m.round), slot: String(m.slot), home: m.homeTeamId ? String(m.homeTeamId) : '', away: m.awayTeamId ? String(m.awayTeamId) : '', when: toLocalInput(m.kickoff), venue: m.venue || '', status: m.status, hg: m.homeGoals != null ? String(m.homeGoals) : '', ag: m.awayGoals != null ? String(m.awayGoals) : '', hp: m.homePens != null ? String(m.homePens) : '', ap: m.awayPens != null ? String(m.awayPens) : '' })
  }
  const setRound = (r: string) => {
    if (!form || form.id) { setForm(f => f && { ...f, round: r }); return }
    setForm({ ...form, round: r, slot: String(nextFreeSlot(Number(r), matches.filter(m => m.round === Number(r)).map(m => m.slot)) ?? 1) })
  }

  const submit = async () => {
    if (!form) return
    const round = Number(form.round) as CupRound, slot = Number(form.slot)
    const num = (v: string) => (v === '' ? null : Number(v))
    const hg = num(form.hg), ag = num(form.ag), hp = num(form.hp), ap = num(form.ap)
    const ints = [hg, ag, hp, ap].every(v => v == null || (Number.isInteger(v) && v >= 0 && v <= 99))
    if (!ROUNDS.includes(round) || !Number.isInteger(slot) || slot < 1 || slot > round / 2 || !ints) { setErr(t.errInvalid); return }
    if (form.home && form.home === form.away) { setErr(t.errSameTeam); return }
    if (form.status === 'played') {
      if (!form.home || !form.away || hg == null || ag == null) { setErr(t.errInvalid); return }
      if (hg === ag && (hp == null || ap == null || hp === ap)) { setErr(t.errNeedPens); return }
    }
    const d = form.when ? new Date(form.when) : null
    if (d && Number.isNaN(d.getTime())) { setErr(t.errInvalid); return }
    setBusy(true); setErr('')
    const r = await saveLeagueCupMatch({
      id: form.id, seasonId: season.id, round, slot, homeTeamId: form.home ? Number(form.home) : null, awayTeamId: form.away ? Number(form.away) : null,
      kickoff: d ? d.toISOString() : null, venue: form.venue || null, status: form.status, homeGoals: hg, awayGoals: ag, homePens: hp, awayPens: ap,
    })
    setBusy(false)
    if (r.error) { setErr(errText(r.error)); return }
    setForm(null); await load()
  }
  const remove = async (m: LeagueCupMatch) => {
    if (!window.confirm(t.confirmDeleteCupMatch)) return
    const r = await deleteLeagueCupMatch(m.id)
    if (r.error) { window.alert(errText(r.error)); return }
    await load()
  }
  const saveInfo = async () => {
    if (!info) return
    setBusy(true); setErr('')
    const r = await saveLeagueCupInfo(season.id, info.name, info.text)
    setBusy(false)
    if (r.error) { setErr(errText(r.error)); return }
    setInfo(null); onInfoSaved()
  }

  const teamSelect = (value: string, onChange: (v: string) => void, id: string) => (
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className={input}>
      <option value="">{t.tbd}</option>
      {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  )

  const row = (m: LeagueCupMatch, side: 'home' | 'away') => {
    const id = side === 'home' ? m.homeTeamId : m.awayTeamId
    const goals = side === 'home' ? m.homeGoals : m.awayGoals
    const pens = side === 'home' ? m.homePens : m.awayPens
    const x = id != null ? byId.get(id) ?? null : null
    const win = cupWinner(m) === id && id != null
    return (
      <div className={`flex items-center gap-2.5 px-3 py-2 ${win ? 'bg-white/[.07]' : ''}`}>
        {id != null ? <ClubMark team={x ?? undefined} src={logoUrl(x)} size={26} /> : <span className="h-[26px] w-[22px] rounded-md border border-dashed border-white/25" aria-hidden />}
        <span className={`min-w-0 flex-1 truncate text-[13px] ${id == null ? 'italic text-white/45' : win ? 'font-black' : 'font-semibold text-white/85'} ${id != null && id === myTeamId ? 'text-[#f6c744]' : ''}`}>{x?.name ?? t.tbd}</span>
        {goals != null && <span className={`text-sm tabular-nums ${win ? 'font-black' : 'font-semibold text-white/70'}`} dir="ltr">{goals}{pens != null && <span className="ms-1 text-[10px] text-white/50">({pens})</span>}</span>}
      </div>
    )
  }

  return (
    <div>
      {/* header: name + description */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-[rgba(var(--line-rgb),.22)] bg-gradient-to-br from-[#16305c] via-[#0f2146] to-[#2a0d1d] p-5 sm:p-7 text-white">
        <span aria-hidden className="pointer-events-none absolute -top-14 -right-8 rtl:-left-8 rtl:right-auto h-56 w-56 rounded-full bg-[#f6c744]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f6c744] text-[#0c1f3d]"><Trophy size={26} /></span>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight leading-tight">{season.cupName || t.cup}</h3>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.3em] text-[#f6c744]">{season.name}</p>
              {season.cupInfo && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-white/75">{season.cupInfo}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {admin && <button onClick={() => { setErr(''); setInfo({ name: season.cupName || '', text: season.cupInfo || '' }) }} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-black/25 ring-1 ring-inset ring-white/15 text-[10px] font-black uppercase tracking-widest hover:bg-white/15"><Pencil size={13} />{t.editCupInfo}</button>}
            {admin && <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E30613] text-[10px] font-black uppercase tracking-widest hover:bg-red-700"><Plus size={14} />{t.addCupMatch}</button>}
          </div>
        </div>
        {champion != null && (
          <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-inset ring-[#f6c744]/40">
            <Trophy size={18} className="text-[#f6c744]" />
            <ClubMark team={byId.get(champion)} src={logoUrl(byId.get(champion) ?? null)} size={32} />
            <div><p className="text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t.champion}</p><p className="text-lg font-black leading-tight">{byId.get(champion)?.name}</p></div>
          </div>
        )}
      </section>

      {matches.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><Trophy size={48} /><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{t.noCup}</p></div>
      )}

      {/* rounds */}
      {rounds.length > 0 && (
        <div className="flex gap-5 overflow-x-auto pb-3 md:items-stretch">
          {rounds.map(r => (
            <section key={r} className="w-[78vw] max-w-[300px] shrink-0 md:w-[280px]" aria-label={t[roundKey(r)]}>
              <h4 className="mb-3 text-[10px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t[roundKey(r)]}</h4>
              <ul className="flex h-[calc(100%-1.75rem)] flex-col justify-around gap-3">
                {matches.filter(m => m.round === r).map(m => {
                  const mine = myTeamId != null && (m.homeTeamId === myTeamId || m.awayTeamId === myTeamId)
                  return (
                    <li key={m.id} className={`overflow-hidden rounded-xl border bg-gradient-to-b from-[#15294d] to-[#0c1730] text-white shadow-[0_8px_20px_rgba(2,8,23,.3)] ${mine ? 'border-[#f6c744]/60' : 'border-[rgba(var(--line-rgb),.22)]'}`}>
                      {row(m, 'home')}
                      <div className="h-px bg-white/10" />
                      {row(m, 'away')}
                      {(m.kickoff || m.status === 'postponed' || admin) && (
                        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/20 px-3 py-1.5 text-[10px] text-white/55">
                          <span className="truncate" dir="ltr">{m.status === 'postponed' ? t.statusPostponed : m.kickoff ? when.format(new Date(m.kickoff)) : ''}{m.venue ? ` · ${m.venue}` : ''}</span>
                          {admin && (
                            <span className="flex shrink-0 items-center">
                              <button onClick={() => openEdit(m)} aria-label={t.edit} className="p-1.5 rounded hover:bg-white/10 hover:text-white"><Pencil size={12} /></button>
                              <button onClick={() => void remove(m)} aria-label={t.confirmDeleteCupMatch} className="p-1.5 rounded hover:bg-[#e3062c]/80 hover:text-white"><Trash2 size={12} /></button>
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* match form */}
      {form && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
          <div role="dialog" aria-modal="true" className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setForm(null)} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
            <h3 className="mb-4 text-lg font-black uppercase tracking-tight">{form.id ? t.editCupMatch : t.addCupMatch}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label} htmlFor="cm-round">{t.roundWord}</label>
                <select id="cm-round" value={form.round} onChange={e => setRound(e.target.value)} className={input}>{ROUNDS.map(r => <option key={r} value={r}>{t[roundKey(r)]}</option>)}</select></div>
              <div><label className={label} htmlFor="cm-slot">{t.slotWord}</label><input id="cm-slot" type="number" min={1} max={Number(form.round) / 2} value={form.slot} onChange={e => setForm({ ...form, slot: e.target.value })} className={input} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="cm-home">{t.homeTeam}</label>{teamSelect(form.home, v => setForm({ ...form, home: v }), 'cm-home')}</div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="cm-away">{t.awayTeam}</label>{teamSelect(form.away, v => setForm({ ...form, away: v }), 'cm-away')}</div>
              <div className="col-span-2"><label className={label} htmlFor="cm-status">{t.status}</label>
                <select id="cm-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FixtureStatus })} className={input}>
                  <option value="scheduled">{t.statusScheduled}</option><option value="played">{t.statusPlayed}</option><option value="postponed">{t.statusPostponed}</option>
                </select></div>
              {form.status === 'played' && (
                <>
                  <div><label className={label} htmlFor="cm-hg">{t.scoreWord} · {t.homeTeam}</label><input id="cm-hg" type="number" min={0} max={99} value={form.hg} onChange={e => setForm({ ...form, hg: e.target.value })} className={input} /></div>
                  <div><label className={label} htmlFor="cm-ag">{t.scoreWord} · {t.awayTeam}</label><input id="cm-ag" type="number" min={0} max={99} value={form.ag} onChange={e => setForm({ ...form, ag: e.target.value })} className={input} /></div>
                  {form.hg !== '' && form.hg === form.ag && (
                    <>
                      <div><label className={label} htmlFor="cm-hp">{t.penaltiesWord} · {t.homeTeam}</label><input id="cm-hp" type="number" min={0} max={99} value={form.hp} onChange={e => setForm({ ...form, hp: e.target.value })} className={input} /></div>
                      <div><label className={label} htmlFor="cm-ap">{t.penaltiesWord} · {t.awayTeam}</label><input id="cm-ap" type="number" min={0} max={99} value={form.ap} onChange={e => setForm({ ...form, ap: e.target.value })} className={input} /></div>
                    </>
                  )}
                </>
              )}
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="cm-when">{t.dateTime}</label><input id="cm-when" type="datetime-local" value={form.when} onChange={e => setForm({ ...form, when: e.target.value })} className={input} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="cm-venue">{t.venue}</label><input id="cm-venue" maxLength={120} value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className={input} /></div>
            </div>
            {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button onClick={() => void submit()} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* cup name + description form */}
      {info && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setInfo(null)}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setInfo(null)} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
            <h3 className="mb-4 text-lg font-black uppercase tracking-tight">{t.editCupInfo}</h3>
            <div className="space-y-3">
              <div><label className={label} htmlFor="ci-name">{t.cupNameLabel}</label><input id="ci-name" maxLength={80} value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} className={input} /></div>
              <div><label className={label} htmlFor="ci-text">{t.cupInfoLabel}</label><textarea id="ci-text" rows={5} maxLength={1000} value={info.text} onChange={e => setInfo({ ...info, text: e.target.value })} className={`${input} resize-none`} /></div>
            </div>
            {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setInfo(null)} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button onClick={() => void saveInfo()} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
