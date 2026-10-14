import { pathToFileURL } from 'url'
import path from 'path'

export type PdfTextLine = { text: string; page: number }

export type ExtractPdfLinesResult = {
  /** Every non-empty visual line found, in reading order, with its 1-based page number. */
  lines: PdfTextLine[]
  /** Pages that had no extractable text items (likely a scanned image page). */
  scannedPages: number
}

/**
 * Extracts text from a PDF as visual lines (pdfjs text items grouped by
 * Y-coordinate into lines, sorted top-to-bottom then left-to-right).
 *
 * Shared by app/api/import-players and app/api/parse-callups, which both
 * need the same pdfjs mechanics but apply their own page/size limits and
 * wrap errors into their own NextResponse shapes — this function is not
 * route-aware: it throws a plain Error on failure instead of returning a
 * response, and takes no auth/size opinion of its own.
 *
 * @param buf PDF file bytes.
 * @param opts.maxPages If set, and the document has more pages than this,
 *   throws an Error with a message in the form "PDF too long (max N pages)"
 *   before any page is parsed, so callers can keep returning their own
 *   status code (413) for this case by checking the message, or simply
 *   leave maxPages unset and enforce the limit themselves using the
 *   returned page count.
 */
export async function extractPdfLines(
  buf: Buffer,
  opts?: { maxPages?: number }
): Promise<ExtractPdfLinesResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdfjs-dist is external (serverExternalPackages), so the real filesystem files exist at runtime
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false }).promise

  if (opts?.maxPages && doc.numPages > opts.maxPages) {
    throw new Error(`PDF too long (max ${opts.maxPages} pages)`)
  }

  const lines: PdfTextLine[] = []
  let scannedPages = 0

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const items = (textContent.items as any[])
      .filter((it: any) => it.str && it.str.trim())
      .map((it: any) => ({
        str: String(it.str).replace(/\s+/g, ' ').trim(),
        x: it.transform?.[4] ?? 0,
        y: it.transform?.[5] ?? 0,
      }))
      .filter((it) => it.str.length > 0)

    if (items.length === 0) {
      scannedPages++
      continue
    }

    // Group items into visual lines by Y coordinate (tolerant to rounding)
    const rows: { y: number; items: { str: string; x: number }[] }[] = []
    for (const it of items) {
      const match = rows.find((l) => Math.abs(l.y - it.y) < 3)
      if (match) match.items.push(it)
      else rows.push({ y: it.y, items: [it] })
    }
    rows.sort((a, b) => b.y - a.y) // PDF y grows upward
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x) // left to right
      const text = row.items.map((i) => i.str).join(' ').trim()
      if (text) lines.push({ text, page: i })
    }
  }

  return { lines, scannedPages }
}
