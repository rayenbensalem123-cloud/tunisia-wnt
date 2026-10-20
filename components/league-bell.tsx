'use client'
// Club accounts: a bell with the changes that concern their club (date set or moved, postponed, result).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import { fetchMyNotifications, markNotificationsRead, fetchLeagueSeasons, fetchLeagueFixtures, type LeagueNotification, type LeagueFixture, type LeagueTeam } from '@/lib/app-data'

export function LeagueBell({ teamId, teams }: { teamId: number; teams: LeagueTeam[] }) {
  const { tr, lang } = useTranslate()
  const t = tr.league
  const [items, setItems] = useState<LeagueNotification[]>([])
  const [fixtures, setFixtures] = useState<LeagueFixture[]>([])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB'
  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [n, seasons] = await Promise.all([fetchMyNotifications(), fetchLeagueSeasons()])
      const s = seasons.find(x => x.isCurrent) ?? seasons[0]
      const f = s ? await fetchLeagueFixtures(s.id) : []
      if (alive) { setItems(n); setFixtures(f) }
    })()
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const unread = items.filter(i => !i.readAt)
  const text = (n: LeagueNotification) => {
    const f = fixtures.find(x => x.id === n.fixtureId)
    if (!f) return ''
    const opp = teams.find(x => x.id === (f.homeTeamId === teamId ? f.awayTeamId : f.homeTeamId))?.name ?? '—'
    const when = f.kickoff ? fmt.format(new Date(f.kickoff)) : t.dateTbd
    const mine = f.homeTeamId === teamId ? f.homeGoals : f.awayGoals, theirs = f.homeTeamId === teamId ? f.awayGoals : f.homeGoals
    const tpl = { scheduled: t.notifScheduled, moved: t.notifMoved, postponed: t.notifPostponed, result: t.notifResult }[n.kind]
    return tpl.replace('{opp}', opp).replace('{when}', when).replace('{score}', `${mine ?? '?'}–${theirs ?? '?'}`)
  }
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unread.length) {
      void markNotificationsRead(unread.map(i => i.id))
      setTimeout(() => setItems(prev => prev.map(i => ({ ...i, readAt: i.readAt ?? new Date().toISOString() }))), 1500)
    }
  }
  return (
    <div ref={box} className="relative">
      <button onClick={toggle} aria-label={t.notifTitle} aria-expanded={open} className="relative p-2.5 rounded-lg border border-[rgba(var(--line-rgb),.25)] hover:border-[#f6c744]/60 transition-all">
        <Bell size={15} />
        {unread.length > 0 && <span className="absolute -top-1.5 -end-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#E30613] px-1 text-[9px] font-black text-white tabular-nums">{unread.length}</span>}
      </button>
      {open && (
        <div role="region" aria-label={t.notifTitle} className="absolute end-0 top-full z-[400] mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-[rgba(var(--line-rgb),.28)] bg-[var(--c-bg)] shadow-[0_16px_40px_rgba(2,8,23,.5)]">
          <p className="border-b border-[rgba(var(--line-rgb),.18)] px-4 py-3 text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t.notifTitle}</p>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-[var(--c-textMid)]">{t.notifNone}</li>}
            {items.map(n => (
              <li key={n.id} className={`border-b border-white/5 px-4 py-3 text-sm ${n.readAt ? 'text-[var(--c-textMid)]' : 'font-bold'}`}>
                {text(n)}
                <span className="mt-0.5 block text-[10px] font-semibold text-[var(--c-textMid)]">{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(n.createdAt))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
