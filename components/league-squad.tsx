'use client'
// A club names the players for an upcoming match.
import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import { setMatchSquad, type LeagueTeam, type LeagueFixture, type LeagueSquadEntry } from '@/lib/app-data'
import { ClubMark } from '@/components/league-ui'

type Props = {
  fixture: LeagueFixture
  myTeamId: number
  teams: LeagueTeam[]
  players: { id: number; name: string }[]
  squad: LeagueSquadEntry[]
  suspendedIds: number[]
  logoUrl: (x: LeagueTeam | null) => string
  onSaved: () => void
  onClose: () => void
}

export function LeagueSquad({ fixture, myTeamId, teams, players, squad, suspendedIds, logoUrl, onSaved, onClose }: Props) {
  const { tr } = useTranslate()
  const t = tr.league
  const [chosen, setChosen] = useState<Set<number>>(new Set(squad.filter(s => s.fixtureId === fixture.id && s.teamId === myTeamId).map(s => s.memberId)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const locked = fixture.status === 'played'
  const opp = teams.find(x => x.id === (fixture.homeTeamId === myTeamId ? fixture.awayTeamId : fixture.homeTeamId)) ?? null
  const banned = new Set(suspendedIds)
  const save = async () => {
    setBusy(true); setErr('')
    const r = await setMatchSquad(fixture.id, myTeamId, [...chosen])
    setBusy(false)
    if (r.error) { setErr(t.errDenied); return }
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t.squadTitle} className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
        <p className="text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t.squadTitle} · {t.matchdayN.replace('{n}', String(fixture.matchday))}</p>
        <div className="mt-2 mb-4 flex items-center gap-2"><ClubMark team={opp ?? undefined} src={logoUrl(opp)} size={28} /><span className="font-black">{opp?.name}</span></div>
        <p className="mb-3 text-sm text-[var(--c-textMid)]">{locked ? t.squadLocked : t.squadHint}</p>
        {players.length === 0 ? <p className="text-sm text-[var(--c-textMid)]">{t.noPlayers}</p> : (
          <div className="flex flex-wrap gap-1.5">
            {players.map(p => {
              const on = chosen.has(p.id), no = banned.has(p.id)
              return (
                <button key={p.id} type="button" disabled={locked || no} aria-pressed={on}
                  onClick={() => setChosen(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition-all disabled:opacity-60 ${no ? 'ring-[#e3062c] text-[#ff5f72]' : on ? 'bg-[#f6c744] text-[#0c1f3d] ring-[#f6c744]' : 'text-[var(--c-textMid)] ring-[rgba(var(--line-rgb),.3)] hover:ring-[#f6c744]/60'}`}>{no && '⛔ '}{p.name}</button>
              )
            })}
          </div>
        )}
        {suspendedIds.length > 0 && <p className="mt-3 text-xs font-bold text-[#ff9aa6]">{t.squadSuspended}</p>}
        {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-xs font-black tabular-nums text-[#f6c744]">{t.squadCount.replace('{n}', String(chosen.size))}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
            {!locked && <button onClick={() => void save()} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">{busy ? '…' : t.squadSave}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
