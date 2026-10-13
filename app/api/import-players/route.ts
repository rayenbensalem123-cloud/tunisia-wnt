import { NextResponse } from 'next/server'
import { requireActiveUser, can, safeError } from '@/lib/api-auth'
import { extractPdfLines } from '@/lib/pdf-text'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const MAX_PAGES = 30

export async function POST(req: Request) {
  let caller
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!can(auth.caller, 'addPlayer')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }
    caller = auth.caller
  } catch (e) {
    return NextResponse.json({ error: safeError(e) }, { status: 500 })
  }
  void caller

  try {
    const len = Number(req.headers.get('content-length') || '0')
    if (len > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 8 MB)' }, { status: 413 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 8 MB)' }, { status: 413 })
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Please upload a PDF file' }, { status: 415 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
  let rows: { text: string; page: number }[] = []
  let scannedPages = 0

  try {
    // Dynamic import (inside extractPdfLines) so the heavy pdfjs module
    // isn't bundled into the main route graph eagerly.
    const extracted = await extractPdfLines(buf, { maxPages: MAX_PAGES })
    rows = extracted.lines
    scannedPages = extracted.scannedPages
  } catch (e: any) {
    const message = typeof e?.message === 'string' ? e.message : ''
    if (message.startsWith('PDF too long')) {
      return NextResponse.json({ error: message }, { status: 413 })
    }
    return NextResponse.json({ error: 'Could not read PDF: ' + safeError(e, 'unknown') }, { status: 400 })
  }

  // Heuristic parse: drop header lines, split into name / team / camp
  const parsed = rows
    .filter((r) => r.text && !isHeader(r.text))
    .map((r) => parsePlayerLine(r.text))
    .filter((r) => r && r.name)

  return NextResponse.json({ rows: parsed, scannedPages, totalLines: rows.length })
  } catch (e) {
    return NextResponse.json({ error: safeError(e) }, { status: 500 })
  }
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
