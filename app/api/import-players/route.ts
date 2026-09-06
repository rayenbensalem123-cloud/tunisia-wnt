import { NextResponse } from 'next/server'
import { pathToFileURL } from 'url'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Please upload a PDF file' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let rows: any[] = []
  let scannedPages = 0

  try {
    // Dynamic import so the heavy pdfjs module isn't bundled into the main route graph eagerly
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // pdfjs-dist is external (serverExternalPackages), so the real filesystem files exist at runtime
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false }).promise

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
      const lines: { y: number; items: { str: string; x: number }[] }[] = []
      for (const it of items) {
        const match = lines.find((l) => Math.abs(l.y - it.y) < 3)
        if (match) match.items.push(it)
        else lines.push({ y: it.y, items: [it] })
      }
      lines.sort((a, b) => b.y - a.y) // PDF y grows upward
      for (const line of lines) {
        // sort items left to right
        line.items.sort((a, b) => a.x - b.x)
        const text = line.items.map((i) => i.str).join(' ')
        if (text.trim()) rows.push({ text: text.trim(), page: i })
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not read PDF: ' + (e?.message || 'unknown') }, { status: 200 })
  }

  // Heuristic parse: drop header lines, split into name / team / camp
  const parsed = rows
    .filter((r) => r.text && !isHeader(r.text))
    .map((r) => parsePlayerLine(r.text))
    .filter((r) => r && r.name)

  return NextResponse.json({ rows: parsed, scannedPages, totalLines: rows.length })
}

function isHeader(line: string): boolean {
  const t = line.toLowerCase()
  if (t.length < 3) return true
  if (/^\s*(name|player|joueur|joueurs|nom|isim|الاسم|club|equipe|equipe|team|takim|اكبر|kamp|camp|list|liste|no\.|#|number|num)/.test(t)) return true
  return false
}

function parsePlayerLine(raw: string): { name: string; team?: string; camp?: string } | null {
  let line = raw.trim().replace(/\s+/g, ' ').replace(/^[•\-\–—*▶▪•●]+\s*/, '')
  if (!line) return null

  // Split on common separators: |, ;, dash, then split comma-joined name/team segments
  let parts: string[] = []
  if (line.includes('|')) parts = line.split('|').map((s) => s.trim()).filter(Boolean)
  else if (line.includes(';')) parts = line.split(';').map((s) => s.trim()).filter(Boolean)
  else {
    // Dash separator between segments (e.g. "Sara Ben Ali, Espérance - Camp Jan")
    const dashSplit = line.split(/\s+(?=[\-\–—])\s*|[\-\–—]\s+/).map((s) => s.trim()).filter(Boolean)
    parts = dashSplit.length >= 2 ? dashSplit : [line]
  }

  // Expand comma-joined segments into name + team + camp when comma precedes a capitalized word
  const expanded: string[] = []
  for (const p of parts) {
    const sub = p.split(/,\s+(?=[A-ZÀ-Ý])/).map((s) => s.trim()).filter(Boolean)
    expanded.push(...sub)
  }
  parts = expanded

  if (parts.length === 1) {
    return { name: cleanName(parts[0]) }
  }
  if (parts.length === 2) return { name: cleanName(parts[0]), team: parts[1] }
  if (parts.length === 3) return { name: cleanName(parts[0]), team: parts[1], camp: parts[2] }
  // 4+ parts: name = first, treat last as camp when it looks like a camp keyword
  const camp = /\b(camp|stage|ret\w+|training|camp)\b/i.test(parts[parts.length - 1]) ? parts.pop() : undefined
  const name = parts[0]
  const team = parts.slice(1).join(' ')
  return { name: cleanName(name), team, camp }
}

function cleanName(raw: string): string {
  let s = raw.trim()
  // strip leading numbering like "17." or "17 -"
  s = s.replace(/^(\d+(\.|\)|\s*-\s*)?\s*)+/, '').trim()
  // Remove trailing/leading punctuation
  s = s.replace(/^[,.:\s]+|[,.:\s]+$/g, '')
  return s
}
