import { NextResponse } from 'next/server'
import { requireActiveUser, safeError } from '@/lib/api-auth'
import { extractPdfLines } from '@/lib/pdf-text'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024
const MAX_PAGES = 30

// Reads a call-up PDF and returns its text lines. Name matching happens in the browser.
export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const len = Number(req.headers.get('content-length') || '0')
    if (len > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 8 MB)' }, { status: 413 })
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 8 MB)' }, { status: 413 })
    if (!file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'Please upload a PDF file' }, { status: 415 })

    const buf = Buffer.from(await file.arrayBuffer())
    let lines: string[] = []
    let scannedPages = 0
    try {
      const extracted = await extractPdfLines(buf, { maxPages: MAX_PAGES })
      lines = extracted.lines.map((l) => l.text)
      scannedPages = extracted.scannedPages
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : ''
      if (message.startsWith('PDF too long')) {
        return NextResponse.json({ error: message }, { status: 413 })
      }
      return NextResponse.json({ error: 'Could not read PDF: ' + safeError(e, 'unknown') }, { status: 400 })
    }
    if (!lines.length) {
      return NextResponse.json({ error: 'This PDF has no readable text (it looks like a scan). Export it as a text PDF and try again.' }, { status: 422 })
    }
    return NextResponse.json({ lines, scannedPages })
  } catch (e) {
    return NextResponse.json({ error: safeError(e) }, { status: 500 })
  }
}
