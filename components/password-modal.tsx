'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'

export type PasswordTarget = { mode: 'self' | 'admin'; username?: string } | null

type Props = {
  target: PasswordTarget
  onClose: () => void
  /** Resolve true on success, or an error string to display. */
  onSubmit: (password: string) => Promise<string | null>
}

const MIN = 6
const MAX = 200

export function PasswordModal({ target, onClose, onSubmit }: Props) {
  const { tr } = useTranslate()
  const [value, setValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!target) return null

  const close = () => {
    setValue('')
    setConfirm('')
    setError('')
    setBusy(false)
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (value.length < MIN) return setError(tr.passwordModal.mustBeAtLeast.replace('{min}', String(MIN)))
    if (value.length > MAX) return setError(tr.passwordModal.tooLong)
    if (value !== confirm) return setError(tr.passwordModal.dontMatch)
    setBusy(true)
    const err = await onSubmit(value)
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
          <h2 className="text-sm font-black uppercase tracking-tight">
            {target.mode === 'self' ? tr.passwordModal.changeTitle : `${tr.passwordModal.resetTitle} — ${target.username}`}
          </h2>
          <button onClick={close} title="Close" className="pm-close"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="block text-[8px] font-black uppercase tracking-wider text-[var(--c-textDim)] mb-1.5">
              {tr.passwordModal.newPassword.replace('{min}', String(MIN))}
            </label>
            <input
              type="password" autoComplete="new-password" value={value} autoFocus
              onChange={e => setValue(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.18)] bg-[var(--c-surface)] text-[var(--c-text)] text-xs font-bold outline-none focus:border-[#E30613]/50"
            />
          </div>
          <div>
            <label className="block text-[8px] font-black uppercase tracking-wider text-[var(--c-textDim)] mb-1.5">
              {tr.passwordModal.confirmPassword}
            </label>
            <input
              type="password" autoComplete="new-password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
