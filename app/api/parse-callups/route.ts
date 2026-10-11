import { NextResponse } from 'next/server'
import { pathToFileURL } from 'url'
import path from 'path'
import { requireActiveUser, safeError } from '@/lib/api-auth'

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
    const lines: string[] = []
    let scannedPages = 0
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false }).promise
      if (doc.numPages > MAX_PAGES) return NextResponse.json({ error: `PDF too long (max ${MAX_PAGES} pages)` }, { status: 413 })
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const items = (content.items as any[])
          .filter((it: any) => it.str && it.str.trim())
          .map((it: any) => ({ str: String(it.str).replace(/\s+/g, ' ').trim(), x: it.transform?.[4] ?? 0, y: it.transform?.[5] ?? 0 }))
        if (!items.length) { scannedPages++; continue }
        const rows: { y: number; items: { str: string; x: number }[] }[] = []
        for (const it of items) {
          const m = rows.find((l) => Math.abs(l.y - it.y) < 3)
          if (m) m.items.push(it)
          else rows.push({ y: it.y, items: [it] })
        }
        rows.sort((a, b) => b.y - a.y)
        for (const r of rows) {
          r.items.sort((a, b) => a.x - b.x)
          const t = r.items.map((x) => x.str).join(' ').trim()
          if (t) lines.push(t)
        }
      }
    } catch (e: any) {
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
