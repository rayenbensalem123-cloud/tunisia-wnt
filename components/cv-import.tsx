'use client'
// "Fill from CV" for the player/staff card form. The server reads the CV (see
// /api/parse-cv); this only merges the suggestions into the open form. Nothing
// is saved until a person reviews the card and presses save.
import { useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import { authHeaders } from '@/lib/auth-headers'
import { mergeCvIntoForm, type CvResult } from '@/lib/cv-extract'

type Props = {
  role: 'PLAYERS' | 'COACHES'
  form: any
  setForm: (f: any) => void
}

export function CvImport({ role, form, setForm }: Props) {
  const { tr } = useTranslate()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const t = tr.cvImport
  const fill = (s: string, n: number) => s.replace('{n}', String(n))

  const onFile = async (file: File) => {
    setBusy(true)
    setMsg(null)
    try {
      const body = new FormData()
      body.set('file', file)
      body.set('role', role)
      const res = await fetch('/api/parse-cv', { method: 'POST', headers: await authHeaders(), body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const text =
          res.status === 503 ? t.notConfigured
          : (res.status === 413 || res.status === 415) && typeof json?.error === 'string' ? json.error
          : t.failed
        setMsg({ text, bad: true })
        return
      }
      const merged = mergeCvIntoForm(form, json as CvResult, false)
      if (merged.filled.length === 0 && merged.historyAdded === 0) {
        setMsg({ text: t.nothing })
        return
      }
      setForm(merged.form)
      const parts = [fill(t.done, merged.filled.length)]
      if (merged.kept.length) parts.push(fill(t.kept, merged.kept.length))
      if (merged.historyAdded) parts.push(fill(t.history, merged.historyAdded))
      setMsg({ text: parts.join(' ') })
    } catch {
      setMsg({ text: t.failed, bad: true })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="mb-3">
      {/* A real <label> around the file input opens the picker natively, with no script click. */}
      <label
        className={`relative flex w-full cursor-pointer select-none items-center justify-center gap-2.5 rounded-xl border border-[#E30613]/50 bg-[#E30613]/10 px-4 py-3 text-[11px] font-black uppercase tracking-[.2em] text-[#ff4b57] transition-colors hover:bg-[#E30613]/20 active:scale-[.99] ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <FileText size={16} strokeWidth={2.2} aria-hidden />
        <span>{busy ? t.reading : t.button}</span>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          disabled={busy}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f) }}
        />
      </label>
      {msg && <p role="status" className={`mt-2 text-xs ${msg.bad ? 'text-[#ff4b57]' : 'text-[var(--c-textMid)]'}`}>{msg.text}</p>}
    </div>
  )
}
