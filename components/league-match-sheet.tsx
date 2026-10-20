'use client'
// Admin: who played and what happened in a match (goals, assists, cards).
import { useMemo, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import {
  addLeagueEvent, deleteLeagueEvent, setLeagueLineup,
  type LeagueTeam, type LeagueFixture, type LeagueMatchEvent, type LeagueLineupEntry, type LeagueSquadEntry, type LeagueRosterEntry, type EventKind,
} from '@/lib/app-data'
import type { Suspension } from '@/lib/league-discipline'
import { ClubMark, label } from '@/components/league-ui'
import { NumberField, SelectField } from '@/components/league-pickers'

type Props = {
  fixture: LeagueFixture
  home: LeagueTeam | undefined
  away: LeagueTeam | undefined
  roster: LeagueRosterEntry[]
  lineup: LeagueLineupEntry[]
  squads: LeagueSquadEntry[]
  events: LeagueMatchEvent[]
  suspensions: Suspension[]
  logoUrl: (x: LeagueTeam | null) => string
  onChanged: () => void
  onClose: () => void
}

export const KIND_ICON: Record<EventKind, string> = { goal: '⚽', assist: '👟', yellow: '🟨', red: '🟥' }

export function LeagueMatchSheet({ fixture, home, away, roster, lineup, squads, events, suspensions, logoUrl, onChanged, onClose }: Props) {
  const { tr } = useTranslate()
  const t = tr.league
  const [playerId, setPlayerId] = useState('')
  const [kind, setKind] = useState<EventKind>('goal')
  const [minute, setMinute] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const sides = [{ team: home, id: fixture.homeTeamId }, { team: away, id: fixture.awayTeamId }]
  const players = useMemo(() => roster.filter(p => p.teamId === fixture.homeTeamId || p.teamId === fixture.awayTeamId), [roster, fixture])
  const banned = new Set(suspensions.map(s => s.memberId))
  const kinds: { value: EventKind; label: string }[] = [
    { value: 'goal', label: `${KIND_ICON.goal} ${t.eventGoal}` }, { value: 'assist', label: `${KIND_ICON.assist} ${t.eventAssist}` },
    { value: 'yellow', label: `${KIND_ICON.yellow} ${t.eventYellow}` }, { value: 'red', label: `${KIND_ICON.red} ${t.eventRed}` },
  ]
  const teamName = (id: number) => (id === fixture.homeTeamId ? home?.name : away?.name) ?? ''

  const run = async (p: Promise<{ error: unknown }>) => { setBusy(true); setErr(''); const r = await p; setBusy(false); if (r.error) { setErr(t.errGeneric); return false } onChanged(); return true }
  const toggle = async (teamId: number, memberId: number) => {
    const cur = lineup.filter(l => l.teamId === teamId).map(l => l.memberId)
    const next = cur.includes(memberId) ? cur.filter(x => x !== memberId) : [...cur, memberId]
    await run(setLeagueLineup(fixture.id, teamId, next))
  }
  const add = async () => {
    const p = players.find(x => String(x.id) === playerId)
    if (!p) { setErr(t.errInvalid); return }
    const ok = await run(addLeagueEvent({ fixtureId: fixture.id, teamId: p.teamId, memberId: p.id, kind, minute: minute === '' ? null : Number(minute) }))
    if (ok) setMinute('')
  }
  const goals = (id: number) => events.filter(e => e.teamId === id && e.kind === 'goal').length
  const mismatch = fixture.status === 'played' && (goals(fixture.homeTeamId) !== fixture.homeGoals || goals(fixture.awayTeamId) !== fixture.awayGoals)

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t.matchSheet} className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
        <p className="text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t.matchSheet} · {t.matchdayN.replace('{n}', String(fixture.matchday))}</p>
        <div className="mt-2 mb-5 flex items-center justify-center gap-3 text-center">
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-sm font-black"><span className="truncate">{home?.name}</span><ClubMark team={home} src={logoUrl(home ?? null)} size={30} /></span>
          <span className="shrink-0 text-xl font-black tabular-nums" dir="ltr">{fixture.status === 'played' ? `${fixture.homeGoals} – ${fixture.awayGoals}` : 'vs'}</span>
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black"><ClubMark team={away} src={logoUrl(away ?? null)} size={30} /><span className="truncate">{away?.name}</span></span>
        </div>

        <h4 className={label}>{t.lineup}</h4>
        <p className="mb-2 text-xs text-[var(--c-textMid)]">{t.lineupHint}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {sides.map(({ team, id }) => {
            const mine = roster.filter(p => p.teamId === id)
            const on = new Set(lineup.filter(l => l.teamId === id).map(l => l.memberId))
            return (
              <div key={id}>
                <p className="mb-1.5 truncate text-[11px] font-black uppercase tracking-[.14em]">{team?.name}</p>
                {(() => {
                  const sq = squads.filter(q => q.teamId === id)
                  return (
                    <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className={sq.length ? 'font-bold text-emerald-300' : 'text-[var(--c-textMid)]'}>{sq.length ? t.squadSubmitted.replace('{n}', String(sq.length)) : t.squadNone}</span>
                      {sq.length > 0 && <button type="button" disabled={busy} onClick={() => void run(setLeagueLineup(fixture.id, id, sq.map(q => q.memberId)))} className="font-black uppercase tracking-[.14em] text-[#f6c744] hover:text-[var(--c-text)]">{t.useSquad}</button>}
                    </div>
                  )
                })()}
                {mine.length === 0 ? <p className="text-xs text-[var(--c-textMid)]">{t.noPlayers}</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {mine.map(p => (
                      <button key={p.id} type="button" disabled={busy} onClick={() => void toggle(id, p.id)} aria-pressed={on.has(p.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition-all ${on.has(p.id) ? 'bg-[#f6c744] text-[#0c1f3d] ring-[#f6c744]' : 'text-[var(--c-textMid)] ring-[rgba(var(--line-rgb),.3)] hover:ring-[#f6c744]/60'} ${banned.has(p.id) ? '!ring-[#e3062c] !text-[#ff5f72]' : ''}`}
                        title={banned.has(p.id) ? t.suspended : undefined}>{banned.has(p.id) && '⛔ '}{p.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {lineup.some(l => banned.has(l.memberId)) && <p className="mt-3 rounded-xl bg-[#3a0b18]/60 px-3.5 py-2 text-xs font-bold text-[#ff9aa6]">{t.suspendedPlayed}</p>}

        <h4 className={`${label} mt-6`}>{t.eventsWord}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_9rem_6rem_auto] sm:items-end">
          <div className="col-span-2 sm:col-span-1"><label className={label} htmlFor="ev-player">{t.playerWord}</label>
            <SelectField id="ev-player" value={playerId} onChange={setPlayerId} title={t.playerWord} placeholder={t.playerWord}
              options={players.map(p => ({ value: String(p.id), label: `${p.name} · ${teamName(p.teamId)}` }))} /></div>
          <div><label className={label} htmlFor="ev-kind">{t.eventKind}</label><SelectField id="ev-kind" value={kind} onChange={v => setKind(v as EventKind)} title={t.eventKind} options={kinds} /></div>
          <div><label className={label} htmlFor="ev-min">{t.minuteWord}</label><NumberField id="ev-min" value={minute} onChange={setMinute} min={1} max={120} allowEmpty title={t.minuteWord} /></div>
          <button type="button" onClick={() => void add()} disabled={busy || !playerId} className="col-span-2 sm:col-span-1 rounded-xl bg-[#E30613] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-40">{t.addEvent}</button>
        </div>
        {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}

        <ul className="mt-4 space-y-1.5">
          {events.length === 0 && <li className="text-sm text-[var(--c-textMid)]">{t.noEvents}</li>}
          {events.map(e => (
            <li key={e.id} className="flex items-center gap-3 rounded-xl bg-white/[.04] px-3.5 py-2 text-sm ring-1 ring-inset ring-white/10">
              <span aria-hidden>{KIND_ICON[e.kind]}</span>
              <span className="w-9 shrink-0 text-xs font-black tabular-nums text-[#f6c744]" dir="ltr">{e.minute != null ? `${e.minute}'` : '–'}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{e.playerName} <span className="font-semibold text-[var(--c-textMid)]">· {teamName(e.teamId)}</span></span>
              <button type="button" onClick={() => void run(deleteLeagueEvent(e.id))} disabled={busy} aria-label={t.deleteEvent} className="p-1.5 rounded-lg text-[var(--c-textMid)] hover:bg-[#e3062c]/80 hover:text-white"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
        {mismatch && <p className="mt-3 rounded-xl bg-[#f6c744]/10 px-3.5 py-2 text-xs font-bold text-[#f6c744]">{t.scoreMismatch.replace('{h}', String(goals(fixture.homeTeamId))).replace('{a}', String(goals(fixture.awayTeamId)))}</p>}
        <div className="mt-5 flex justify-end"><button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[#f6c744] text-[10px] font-black uppercase tracking-widest text-[#0c1f3d] hover:bg-white">{t.done}</button></div>
      </div>
    </div>
  )
}
