import { NextResponse } from 'next/server'
import { requireActiveUser, can, safeError } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractPdfLines } from '@/lib/pdf-text'
import { extractPdfImages } from '@/lib/pdf-scan'
import { ocrImages } from '@/lib/ocr'
import { parseCampList } from '@/lib/camp-list'

export const runtime = 'nodejs'
// OCR of an image-only page can take a while on a cold start (traineddata is
// fetched on first use), so give it more room than a plain text extraction.
export const maxDuration = 300

const MAX_BYTES = 8 * 1024 * 1024 // per file
const MAX_TOTAL = 20 * 1024 * 1024
const MAX_PAGES = 30
const MAX_FILES = 8

type FileKind = 'pdf' | 'image'

/** Decide by bytes, never by the file name a browser reports. */
function sniff(b: Uint8Array): FileKind | null {
  const ascii = (from: number, n: number) => String.fromCharCode(...b.slice(from, from + n))
  if (ascii(0, 5) === '%PDF-') return 'pdf'
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image'
  if (b[0] === 0xff && b[1] === 0xd8) return 'image'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image'
  return null
}

export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!can(auth.caller, 'addPlayer')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const rl = await checkRateLimit(`import-players:${auth.caller.id}`, { limit: 15, windowSeconds: 300 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 })
    }

    const len = Number(req.headers.get('content-length') || '0')
    if (len > MAX_TOTAL) return NextResponse.json({ error: 'Files too large (20 MB total)' }, { status: 413 })

    const form = await req.formData()
    const files = form.getAll('file').filter((f): f is File => f instanceof File)
    if (!files.length) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Up to ${MAX_FILES} files at a time` }, { status: 413 })

    let campNames: string[] = []
    try {
      const raw = form.get('campNames')
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) campNames = parsed.filter((x): x is string => typeof x === 'string')
      }
    } catch { /* camp names are only a parsing hint; ignore malformed input */ }

    const lines: string[] = []
    let scannedPages = 0
    let ocredPages = 0
    let ocrFailures = 0

    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: `File too large (max 8 MB): ${file.name}` }, { status: 413 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const kind = sniff(buf)
      if (!kind) {
        return NextResponse.json({ error: 'Please upload a PDF or an image (PNG, JPG, WEBP)' }, { status: 415 })
      }

      if (kind === 'image') {
        try {
          const ocr = await ocrImages([buf])
          lines.push(...ocr.lines)
          ocredPages++
          ocrFailures += ocr.failed
        } catch (e) {
          return NextResponse.json({ error: 'Could not read the image: ' + safeError(e, 'unknown') }, { status: 500 })
        }
        continue
      }

      let extracted
      try {
        extracted = await extractPdfLines(buf, { maxPages: MAX_PAGES })
      } catch (e: any) {
        const message = typeof e?.message === 'string' ? e.message : ''
        if (message.startsWith('PDF too long')) {
          return NextResponse.json({ error: message }, { status: 413 })
        }
        return NextResponse.json({ error: 'Could not read PDF: ' + safeError(e, 'unknown') }, { status: 400 })
      }

      lines.push(...extracted.lines.map((l) => l.text))
      scannedPages += extracted.scannedPages

      if (extracted.scannedPageList.length) {
        try {
          const images = await extractPdfImages(buf, extracted.scannedPageList)
          if (images.length) {
            const ocr = await ocrImages(images, 'eng+fra')
            lines.push(...ocr.lines)
            ocredPages += ocr.failed === 0 ? images.length : Math.max(0, images.length - ocr.failed)
            ocrFailures += ocr.failed
          }
        } catch (e) {
          // A PDF whose images pdfjs cannot decode is unusual; keep the text we
          // already have instead of failing the whole import.
          console.error('scanned PDF OCR skipped:', safeError(e, 'unknown'))
        }
      }
    }

    const rows = parseCampList(lines, campNames)

    return NextResponse.json({
      rows,
      scannedPages,
      ocredPages,
      ocrFailures,
      totalLines: lines.length,
    })
  } catch (e) {
    return NextResponse.json({ error: safeError(e) }, { status: 500 })
  }
}
