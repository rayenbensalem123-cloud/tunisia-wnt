'use client'
// Head-to-head against one opponent: record, goals, last meetings, scorers.
// Reads the national team's own match list; shows nothing until the opponent is known.
import { useMemo } from 'react'
import { useTranslate } from '@/lib/language-context'
import { headToHead, type H2HMatch } from '@/lib/head-to-head'

type Props = {
  matches: H2HMatch[]
  members: { id: number | string; name?: string }[]
  opponent: string
  category: string
  excludeId?: number | string
  /** Shorter version (record bar and last three meetings) for the new-match form. */
  compact?: boolean
}

const tone = { W: 'bg-[#f6c744] text-[#0c1f3d]', D: 'bg-[var(--c-surface)] text-[var(--c-textBlue)] ring-1 ring-inset ring-[rgba(var(--line-rgb),.3)]', L: 'bg-[#e3062c] text-white' } as const

export function HeadToHead({ matches, members, opponent, category, excludeId, compact }: Props) {
  const { tr, lang } = useTranslate()
  const t = tr.h2h
  const names = useMemo(() => Object.fromEntries(members.map(m => [Number(m.id), String(m.name ?? '')])), [members])
  const h = useMemo(() => headToHead(matches, opponent, { category, excludeId, names }), [matches, opponent, category, excludeId, names])
  const fmt = useMemo(() => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), [lang])
  const day = (d: string) => (d ? fmt.format(new Date(d + 'T00:00:00')) : '')
  if (!opponent.trim()) return null

  if (h.played === 0) {
    return <p className="rounded-xl border border-dashed border-[rgba(var(--line-rgb),.3)] px-4 py-3 text-[11px] font-bold text-[var(--c-textMid)]">{t.firstMeeting.replace('{opp}', opponent)}</p>
  }
  const seg = (n: number) => `${(n / h.played) * 100}%`
  const tile = (label: string, value: string) => (
    <div className="rounded-xl bg-[var(--c-raised)] px-3 py-2.5 ring-1 ring-inset ring-[rgba(var(--line-rgb),.14)]">
      <p className="text-base font-black tabular-nums text-[var(--c-text)]" dir="ltr">{value}</p>
      <p className="mt-0.5 text-[8px] font-black uppercase tracking-[.16em] text-[var(--c-textFaint)]">{label}</p>
    </div>
  )
  const meet = (m: { id: string; date: string; competition: string; gf: number; ga: number; outcome: 'W' | 'D' | 'L' }) => (
    <li key={m.id} className="flex items-center gap-3 text-[11px]">
      <span className="w-24 shrink-0 font-bold tabular-nums text-[var(--c-textMid)]">{day(m.date)}</span>
      <span className="min-w-0 flex-1 truncate text-[var(--c-textMid)]">{m.competition || t.friendly}</span>
      <span className={`shrink-0 rounded-md px-2 py-0.5 font-black tabular-nums ${tone[m.outcome]}`} dir="ltr">{m.gf}–{m.ga}</span>
    </li>
  )

  return (
    <section aria-label={`${t.title} · ${opponent}`} className="rounded-2xl border border-[rgba(var(--line-rgb),.18)] bg-[var(--c-deep)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[9px] font-black uppercase tracking-[.25em] text-[#f6c744] [html[data-theme=light]_&]:text-[#8a6100]">{t.title} · {opponent}</h3>
        {h.streak && <span className={`rounded-md px-2 py-0.5 text-[10px] font-black tabular-nums ${tone[h.streak.type]}`} title={t.streak}>{h.streak.type}{h.streak.n}</span>}
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--c-surface)]" role="img" aria-label={`${h.w} ${t.won}, ${h.d} ${t.drawn}, ${h.l} ${t.lost}`}>
        <span className="bg-[#f6c744]" style={{ width: seg(h.w) }} /><span className="bg-[var(--c-textFaint)]/60" style={{ width: seg(h.d) }} /><span className="bg-[#e3062c]" style={{ width: seg(h.l) }} />
      </div>
      <p className="mt-1.5 flex justify-between text-[10px] font-black tabular-nums text-[var(--c-textMid)]" dir="ltr"><span>{h.w} {t.won}</span><span>{h.d} {t.drawn}</span><span>{h.l} {t.lost}</span></p>

      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tile(t.played, String(h.played))}{tile(t.goals, `${h.gf}–${h.ga}`)}{tile(t.winRate, `${h.winRate}%`)}{tile(t.cleanSheets, String(h.cleanSheets))}
        </div>
      )}

      <h4 className="mb-1.5 mt-4 text-[8px] font-black uppercase tracking-[.2em] text-[var(--c-textFaint)]">{t.lastMeetings}</h4>
      <ul className="space-y-1.5">{h.last.slice(0, compact ? 3 : 5).map(meet)}</ul>

      {!compact && (h.biggestWin || h.heaviestLoss) && (
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
          {h.biggestWin && <div className="flex justify-between gap-2"><dt className="text-[var(--c-textMid)]">{t.biggestWin}</dt><dd className="font-black tabular-nums text-[#f6c744] [html[data-theme=light]_&]:text-[#8a6100]" dir="ltr">{h.biggestWin.gf}–{h.biggestWin.ga} · {day(h.biggestWin.date)}</dd></div>}
          {h.heaviestLoss && <div className="flex justify-between gap-2"><dt className="text-[var(--c-textMid)]">{t.heaviestLoss}</dt><dd className="font-black tabular-nums text-[#ff5f72]" dir="ltr">{h.heaviestLoss.gf}–{h.heaviestLoss.ga} · {day(h.heaviestLoss.date)}</dd></div>}
        </dl>
      )}
      {!compact && h.scorers.length > 0 && (
        <p className="mt-3 text-[11px] text-[var(--c-textMid)]"><span className="font-black uppercase tracking-[.14em] text-[var(--c-textFaint)]">{t.topScorers}: </span>{h.scorers.map(s => `${s.name} (${s.goals})`).join(', ')}</p>
      )}
    </section>
  )
}
