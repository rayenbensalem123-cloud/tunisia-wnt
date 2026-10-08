'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'

type Props = {
  open: boolean
  currentEmail: string | null
  onClose: () => void
  /** Resolve null on success, or an error string to display. */
  onSubmit: (email: string) => Promise<string | null>
}

export function EmailModal({ open, currentEmail, onClose, onSubmit }: Props) {
  const { tr } = useTranslate()
  const [value, setValue] = useState(currentEmail || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setValue(currentEmail || ''); setError('') } }, [open, currentEmail])

  if (!open) return null

  const close = () => { setError(''); setBusy(false); onClose() }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const err = await onSubmit(value.trim())
    setBusy(false)
    if (err) return setError(err)
    close()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80" onClick={close}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-cream2)] text-[var(--c-text)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(var(--line-rgb),.12)]">
          <h2 className="text-sm font-black uppercase tracking-tight">{tr.emailModal.title}</h2>
          <button onClick={close} title="Close" className="pm-close"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-[10px] font-semibold text-[var(--c-textDim)]">{tr.emailModal.hint}</p>
          <div>
            <label className="block text-[8px] font-black uppercase tracking-wider text-[var(--c-textDim)] mb-1.5">
              {tr.emailModal.emailLabel}
            </label>
            <input
              type="email" autoComplete="email" value={value} autoFocus
              onChange={e => setValue(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.18)] bg-[var(--c-surface)] text-[var(--c-text)] text-xs font-bold outline-none focus:border-[#E30613]/50"
            />
          </div>
          {error && <p className="text-[8px] font-black uppercase tracking-wider text-[#ff4f66]">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-50"
            >
              {busy ? tr.passwordModal.saving : tr.passwordModal.save}
            </button>
            <button
              type="button" onClick={close}
              className="px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.18)] text-[9px] font-black uppercase tracking-wider text-[var(--c-textDim)]"
            >
              {tr.passwordModal.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
