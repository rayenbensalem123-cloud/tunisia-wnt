'use client'
// "Fill from CV" for the player/staff card form. The server reads the CV (see
// /api/parse-cv); this only merges the suggestions into the open form. Nothing
// is saved until a person reviews the card and presses save.
import { useRef, useState } from 'react'
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
  const [replace, setReplace] = useState(false)
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
      const merged = mergeCvIntoForm(form, json as CvResult, replace)
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
    <div style={{ position: 'relative', marginBottom: 12, padding: 10, border: '1px dashed currentColor', borderRadius: 8 }}>
      {/* A real <label> around the file input opens the picker natively, with no script click. */}
      <label
        className="cursor-pointer select-none"
        style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 8, fontWeight: 700, background: '#E30613', color: '#fff', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}
      >
        {busy ? t.reading : `📄 ${t.button}`}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          disabled={busy}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f) }}
        />
      </label>
      <label className="cursor-pointer" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
        <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> {t.replace}
      </label>
      <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.7 }}>{t.hint}</p>
      {msg && <p role="status" style={{ margin: '6px 0 0', fontSize: 13, color: msg.bad ? '#E30613' : undefined }}>{msg.text}</p>}
    </div>
  )
}
