/**
 * Parses the text of a roster document that lists players across every camp.
 *
 * Two layouts are understood, and both can be mixed in one document:
 *
 *   1. Camp as a section header (typical "full camp list" export):
 *
 *        CAMP MARCH 2026 — TUNIS
 *        1. Sara Ben Ali, Espérance
 *        2. Aïcha Trabelsi, ASFAR
 *        STAGE U20 JULY — 12/07/2026
 *        Lina Khelifi | Stade Tunisien
 *
 *   2. Camp as a column (typical spreadsheet export):
 *
 *        Name | Club | Camp
 *        Sara Ben Ali | Espérance | Camp March 2026
 *
 * Every returned row carries the camp it belongs to, so the importer can
 * register the player into that camp's real roster (not just a free-text tag).
 *
 * This module is pure and has no Next.js or browser dependencies, so it can be
 * used by the API route and exercised directly by scripts/test-camp-list.mjs.
 */

// Kept local (same rules as lib/callups.ts) so this file stays dependency-free
// and can be run directly by the Node type-stripping tests.
const norm = (s: string): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z؀-ۿ]+/g, ' ')
    .trim()

export type CampListRow = { name: string; team?: string; camp?: string }

const CAMP_KEYWORD = /\b(camp|stage|rassemblement|training|معسكر)\b/i
const GENERIC_HEADER = /^(no\.?|n[°º]|#|num(?:ber|éro)?|name|nom|player|joueurs?|isim|الاسم|اللاعبة|club|équipe|equipe|team|takim|liste|list|pos(?:ition)?|poste|âge|age|date|pays|country)\b/i
const PAGE_NOISE = /^(page|صفحة)\s+\d+(\s*\/\s*\d+)?$/i
const LETTERS = /\p{L}/gu

const isCampHeader = (line: string, campNames: string[]): string | null => {
  const n = norm(line)
  if (!n || n.length > 100) return null

  // A camp that already exists is the strongest signal — match it even when
  // the document writes it slightly differently (accents, case, punctuation).
  for (const c of campNames) {
    const cn = norm(c)
    if (cn.length >= 4 && (n === cn || (cn.length >= 6 && n.includes(cn)))) return c
  }

  // Keep the document's own wording: it is what the user will compare with
  // the camp names already in the platform.
  // No \b here: a word boundary does not work next to Arabic letters in JS.
  if (/^(?:camp|stage|rassemblement|training\s+camp|معسكر)(?=\s|$)/i.test(line) && line.length < 95) return line
  return null
}

const isNoise = (line: string): boolean => {
  const t = line.trim()
  if (!t || GENERIC_HEADER.test(t) || PAGE_NOISE.test(t)) return true
  if (/^(total|totals| المجموع|المجموع)\b/i.test(t)) return true
  if (/@|https?:\/\/|www\./i.test(t)) return true
  if ((t.match(LETTERS) || []).length < 2) return true
  if (t.length > 200) return true
  return false
}

const cleanName = (raw: string): string =>
  raw
    .replace(/^[\d]+(?:[.)°]|\s*[-–—:])\s*/, '') // leading "17." / "17 -"
    .replace(/^[•\-\–—*▶▪●]+\s*/, '') // bullets
    .replace(/^[,.:\s]+|[,.:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Splits one visual line into its cells, for both table and free-text rows. */
const cellsOf = (line: string): string[] => {
  let parts: string[]
  if (line.includes('\t') || line.includes('|') || line.includes(';')) {
    parts = line.split(/[\t|;]+/)
  } else {
    const dash = line.split(/\s+[-–—]\s+/)
    parts = dash.length >= 2 ? dash : [line]
  }
  const expanded: string[] = []
  for (const p of parts) {
    // "Sara Ben Ali, Espérance" -> name + club
    expanded.push(...p.split(/,\s+(?=\p{L})/u))
  }
  return expanded.map((p) => p.trim()).filter(Boolean)
}

const looksLikeCamp = (cell: string, campNames: string[]): boolean => {
  const cn = norm(cell)
  if (CAMP_KEYWORD.test(cell) && cell.length < 100) return true
  return campNames.some((c) => {
    const known = norm(c)
    return known.length >= 4 && (cn === known || (known.length >= 6 && cn.includes(known)))
  })
}

/**
 * @param lines visual text lines, in reading order (from PDF text or OCR)
 * @param campNames names of camps already in the platform, used to recognise
 *                  section headers and camp columns precisely
 */
export function parseCampList(lines: string[], campNames: string[] = []): CampListRow[] {
  const rows: CampListRow[] = []
  const seen = new Set<string>()
  let currentCamp = ''

  for (const raw of lines) {
    const line = String(raw || '').replace(/\s+/g, ' ').trim()
    if (!line) continue

    const header = isCampHeader(line, campNames)
    if (header) {
      currentCamp = header
      continue
    }
    if (isNoise(line)) continue

    const cells = cellsOf(line)
    if (!cells.length) continue

    let name = cleanName(cells[0])
    let team = ''
    let camp = currentCamp

    if (cells.length >= 2) {
      // The camp may be encoded as the last column instead of a section header.
      for (let i = cells.length - 1; i >= 1; i--) {
        if (looksLikeCamp(cells[i], campNames)) {
          camp = cells[i].trim() || camp
          cells.splice(i, 1)
          break
        }
      }
      if (cells.length >= 2) team = cells[1].trim()
    }

    if ((name.match(LETTERS) || []).length < 2 || name.length > 100) continue

    const key = `${norm(name)}|${norm(camp)}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({
      name,
      ...(team ? { team } : {}),
      ...(camp ? { camp } : {}),
    })
  }

  return rows
}
