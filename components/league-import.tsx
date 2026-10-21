'use client'
// Admin: paste the official calendar, check it, and load it into the season.
import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import { bulkCreateLeagueFixtures, deleteSeasonFixtures, type LeagueTeam } from '@/lib/app-data'
import { parseCalendar } from '@/lib/league-import'
import { label } from '@/components/league-ui'

type Props = { seasonId: number; seasonYear: number; seasonMonth: number; teams: LeagueTeam[]; existing: number; played: number; onClose: () => void; onDone: () => void }

export function LeagueImport({ seasonId, seasonYear, seasonMonth, teams, existing, played, onClose, onDone }: Props) {
  const { tr } = useTranslate()
  const t = tr.league
  const [text, setText] = useState('')
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const rows = useMemo(() => parseCalendar(text, teams, seasonYear, seasonMonth), [text, teams, seasonYear, seasonMonth])
  const bad = rows.filter(r => r.errors.length)
  const msg = (e: string) => {
    if (e.startsWith('club:')) return t.impErrClub.replace('{name}', e.slice(5))
    if (e.startsWith('twice')) return t.impErrTwice
    return ({ format: t.impErrFormat, date: t.impErrDate, time: t.impErrTime, matchday: t.impErrMatchday, sameClub: t.impErrSame } as Record<string, string>)[e] ?? e
  }
  const blocked = existing > 0 && !replace
  const go = async () => {
    if (!rows.length || bad.length || blocked) return
    setBusy(true); setErr('')
    if (existing > 0) { const d = await deleteSeasonFixtures(seasonId); if (d.error) { setBusy(false); setErr(t.errGeneric); return } }
    const r = await bulkCreateLeagueFixtures(rows.map(x => ({
      seasonId, matchday: x.matchday!, homeTeamId: x.homeTeamId!, awayTeamId: x.awayTeamId!, venue: x.venue,
      kickoff: x.date ? new Date(`${x.date}T${x.time ?? '15:00'}`).toISOString() : null,
    })))
    setBusy(false)
    if (r.error) { setErr(t.errGeneric); return }
    onDone()
  }
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 rtl:left-3 rtl:right-auto p-2 rounded-full bg-black/30 text-white" aria-label={t.cancel}><X size={14} /></button>
        <h3 className="mb-1 text-lg font-black uppercase tracking-tight">{t.importTitle}</h3>
        <p className="mb-4 text-sm text-[var(--c-textMid)]">{t.importHelp}</p>
        <label className={label} htmlFor="imp-text">{t.importCalendar}</label>
        <textarea id="imp-text" value={text} onChange={e => setText(e.target.value)} rows={10} spellCheck={false} placeholder={t.importPlaceholder}
          className="w-full rounded-xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-deep)] px-3.5 py-3 font-mono text-[13px] leading-relaxed text-[var(--c-text)] outline-none focus:border-[#f6c744]/70" />
        <div aria-live="polite" className="mt-3 space-y-2">
          {rows.length === 0 && <p className="text-sm text-[var(--c-textMid)]">{t.importNone}</p>}
          {rows.length > 0 && bad.length === 0 && <p className="rounded-xl bg-[#f6c744]/10 px-3.5 py-2.5 text-sm font-bold text-[#f6c744]">{t.importReady.replace('{n}', String(rows.length))}</p>}
          {bad.length > 0 && (
            <ul className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-[#e3062c]/40 bg-[#3a0b18]/40 p-3">
              {bad.map(r => (
                <li key={r.line} className="text-xs">
                  <span className="font-black text-[#ff5f72]">{t.importLine.replace('{n}', String(r.line))}</span>
                  <span className="ms-2 text-[var(--c-textMid)]" dir="auto">{r.text}</span>
                  <span className="block font-semibold text-[#ff9aa6]">{[...new Set(r.errors.map(msg))].join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {existing > 0 && (
          <label className="mt-3 flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1" checked={replace} onChange={e => setReplace(e.target.checked)} />
            <span>{t.importReplace.replace('{n}', String(existing))}{played > 0 && <span className="block text-xs font-bold text-[#ff9aa6]">{t.importReplacePlayed}</span>}</span></label>
        )}
        {err && <p role="alert" className="mt-3 text-xs font-bold text-[#ff5f72]">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[12px] font-black uppercase tracking-widest">{t.cancel}</button>
          <button onClick={() => void go()} disabled={busy || !rows.length || bad.length > 0 || blocked} title={blocked ? t.importNeedsReplace : undefined}
            className="px-5 py-2.5 rounded-xl bg-[#E30613] text-white text-[12px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-40">{busy ? '…' : t.importGo}</button>
        </div>
      </div>
    </div>
  )
}
