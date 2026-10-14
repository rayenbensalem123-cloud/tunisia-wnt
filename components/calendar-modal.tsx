'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import { getMyCalendarToken } from '@/lib/app-data'

export function CalendarModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tr } = useTranslate()
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(''); setCopied(false)
    getMyCalendarToken().then(r => { setToken(r.token); if (r.error) setError(r.error) })
  }, [open])

  if (!open) return null
  const httpsUrl = token ? `${window.location.origin}/api/calendar/${token}.ics` : ''
  const webcalUrl = httpsUrl.replace(/^https?:/, 'webcal:')

  const copy = async () => {
    try { await navigator.clipboard.writeText(httpsUrl); setCopied(true) } catch { setError('Copy failed') }
  }
  const rotate = async () => {
    if (!window.confirm(tr.calendarModal.regenConfirm)) return
    const r = await getMyCalendarToken(true)
    setToken(r.token); setError(r.error || ''); setCopied(false)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-cream2)] text-[var(--c-text)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(var(--line-rgb),.12)]">
          <h2 className="text-sm font-black uppercase tracking-tight">{tr.calendarModal.title}</h2>
          <button onClick={onClose} title="Close" className="pm-close"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[10px] font-semibold text-[var(--c-textDim)]">{tr.calendarModal.hint}</p>
          {token && (
            <>
              <input readOnly value={httpsUrl} onFocus={e => e.currentTarget.select()}
                className="w-full px-3 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.18)] bg-[var(--c-surface)] text-[var(--c-text)] text-[10px] font-mono outline-none" />
              <div className="flex gap-2">
                <button onClick={copy} className="flex-1 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider">
                  {copied ? tr.calendarModal.copied : tr.calendarModal.copy}
                </button>
                <a href={webcalUrl} className="flex-1 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.18)] text-center text-[9px] font-black uppercase tracking-wider">
                  {tr.calendarModal.subscribe}
                </a>
              </div>
              <p className="text-[9px] font-semibold text-[var(--c-textDim)]">{tr.calendarModal.private}</p>
              <button onClick={rotate} className="text-[9px] font-black uppercase tracking-wider text-[#ff4f66]">{tr.calendarModal.regen}</button>
            </>
          )}
          {error && <p className="text-[8px] font-black uppercase tracking-wider text-[#ff4f66]">{error}</p>}
        </div>
      </div>
    </div>
  )
}
