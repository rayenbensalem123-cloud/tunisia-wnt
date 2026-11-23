/**
 * Extracts a player roster from a scanned/typed list.
 *
 * The documents this sees are not clean databases: one page can hold a proper
 * "N° | Nom et Prénom | Club" table and the following pages hold a training
 * programme, a project report and paragraphs of prose. Reading every text
 * line as a player produces nonsense ("situations proches du match"), so this
 * module locks onto the table block and ignores everything around it.
 *
 * Pure module (no Next.js/browser imports) so scripts/test-player-list.mjs can
 * exercise it directly with node --experimental-strip-types.
 */

export type PlayerRow = { name: string; team?: string }

type Line = { text: string; page: number }

const norm = (s: string): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim()

const NAME_WORD = /\b(nom|name|joueuses?|joueurs?|players?|isim|الاسم|اللاعبات?)\b/i
const CLUB_WORD = /\b(club|equipe|équipe|team|takim|نادي)\b/i
// Real scans write row numbers as "1.", "11\"", "2A", "1,4." — accept all of
// them rather than silently ending the table at the first odd-looking number.
const NUMBER_PREFIX = /^\s*\d{1,3}[A-Za-z]?\s*[.).\-:,;"'’]?\s*(.*)$/

function stripNumber(line: string): string | null {
  const m = NUMBER_PREFIX.exec(line)
  if (!m) return null
  let rest = m[1].trim().replace(/^\d{1,2}\s*[.).]\s*/, '').trim() // "1,4. Name"
  rest = rest.replace(/\s+(?:U\d{2}[A-Z]?\d*|R\d)\b/gi, '').trim() // trailing category tags
  return rest || null
}
const JUNK = /^(u\d+[a-z]?|u1[789]r?\d*|pts|total|n\.?a\.?|r[12]|لاعبة)$/i
const PROSE = /\b(de|des|du|la|le|les|et|avec|pour|dans|sur|que|qui|un|une|au|aux|ne|pas|ce|cette|par|ainsi|sont|été|être|plus|mais|leur|ses|son|dont|comme|selon|vise|doit|peut|après|avant)\b/gi
const LETTERS = /\p{L}/gu

const clean = (s: string): string =>
  s
    .replace(/^[•\-\–—*▶▪●]+\s*/, '')
    .replace(/^[,.:\s]+|[,.:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const looksLikeHeader = (line: string): boolean => {
  if (!NAME_WORD.test(line)) return false
  // "N° Nom et Prénom Club", "Name | Club", " LISTE DES JOUEUSES …"
  return CLUB_WORD.test(line) || /^\s*(n[°º"']?|no\.?|#)\b/i.test(line)
}

const isJunk = (line: string): boolean =>
  !line ||
  line.length < 4 ||
  JUNK.test(line) ||
  (line.match(LETTERS) || []).length < 3 ||
  /@|https?:\/\/|www\./i.test(line)

const countProse = (s: string): number => (s.match(PROSE) || []).length

/** Split "Name Club", "Name | Club" or "Name  Club" into its two cells. */
const splitCells = (rest: string): string[] => {
  if (/[\t|;]/.test(rest)) return rest.split(/[\t|;]+/).map(clean).filter(Boolean)
  if (/\s{2,}/.test(rest)) return rest.split(/\s{2,}/).map(clean).filter(Boolean)
  return [clean(rest)]
}

function validName(name: string): boolean {
  if (!name || name.length > 80) return false
  const tokens = name.split(/\s+/)
  if (tokens.length < 1 || tokens.length > 5) return false
  if ((name.match(LETTERS) || []).length < 4) return false
  if (/\d/.test(name)) return false
  if (countProse(name) > 1) return false
  if (looksLikeHeader(name)) return false
  return true
}

/** Split "Kmar makhlouf BH" into name + club using known clubs as a hint. */
function parseRow(line: string, clubs: string[]): PlayerRow | null {
  const numbered = stripNumber(line)
  const rest = clean(numbered ?? line)
  if (!rest) return null

  const cells = splitCells(rest)
  let name = cells[0] || ''
  let team = cells.slice(1).join(' ').trim()

  if (cells.length === 1) {
    const nRest = norm(rest)
    // Longest first, so "OGC Nice" wins over "Nice".
    for (const club of [...clubs].sort((a, b) => b.length - a.length)) {
      const nClub = norm(club)
      if (nClub.length >= 2 && nRest.endsWith(` ${nClub}`)) {
        team = club
        name = clean(rest.slice(0, rest.length - club.length))
        break
      }
    }
    if (!team) {
      const words = rest.split(/\s+/)
      const last = words[words.length - 1]
      if (words.length >= 3 && /^[\p{Lu}0-9]{2,6}$/u.test(last)) {
        team = last
        name = clean(words.slice(0, -1).join(' '))
      }
    }
  }

  if (!validName(name)) return null
  return { name, ...(team ? { team } : {}) }
}

/**
 * @param lines text lines in reading order (PDF text layer or OCR)
 * @param clubs club names already in the platform, used only to split a club
 *              off the end of a name — never to decide if a line is a player
 */
export function parsePlayerList(lines: Line[], clubs: string[] = []): PlayerRow[] {
  const rows: PlayerRow[] = []
  const seen = new Set<string>()
  let inTable = false
  let tablePage = -1
  let foundRow = false
  let numberedTable = false

  for (const entry of lines) {
    const line = clean(String(entry?.text || ''))
    if (isJunk(line)) continue

    if (looksLikeHeader(line)) {
      inTable = true
      tablePage = entry.page
      continue
    }
    if (!inTable || entry.page !== tablePage) continue

    const numbered = stripNumber(line) !== null
    // Once a numbered roster starts, anything without a number is outside the
    // table (a signature, a programme line, a paragraph) — stop there.
    if (foundRow && numberedTable && !numbered && !/[\t|;]/.test(line)) {
      // A club sometimes wraps onto its own line ("Azieu" after "Club Genas").
      // Let short single-word continuations through; real prose stops the table.
      if (!line.includes(' ') && line.length <= 18 && countProse(line) === 0) continue
      break
    }

    const row = parseRow(line, clubs)
    if (row) {
      const key = norm(row.name)
      if (!seen.has(key)) { seen.add(key); rows.push(row) }
      if (!foundRow) numberedTable = numbered
      foundRow = true
      continue
    }
    // The first non-row line after the table is the end of the roster block —
    // everything after it is programme, methodology or a signature.
    if (foundRow) break
  }

  // No table header found: accept only unmistakable one-player-per-line lists.
  if (!rows.length) {
    for (const entry of lines) {
      const line = clean(String(entry?.text || ''))
      if (isJunk(line) || looksLikeHeader(line) || countProse(line) > 0) continue
      if (/^\d+[.).\-:]?\s+/.test(line)) continue
      const words = line.split(/\s+/)
      if (words.length < 2 || words.length > 4) continue
      if (words.every((w) => /^[\p{Lu}]+$/u.test(w))) continue // ALL CAPS headings
      const row = parseRow(line, clubs)
      if (!row || !validName(row.name)) continue
      const key = norm(row.name)
      if (!seen.has(key)) { seen.add(key); rows.push(row) }
    }
  }

  return rows
}
