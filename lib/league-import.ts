// Turns a pasted calendar (the official draw) into fixtures. Pure, no imports.
// Accepted, one match per line, mixed freely:
//   Matchday 3            (or "Journée 3", "J3", "Round 3", "الجولة 3") sets the matchday for the lines below
//   Club A - Club B  25/10/2026 15:00 Stade X
//   3 ; Club A ; Club B ; 25/10/2026 ; 15:00 ; Stade X      (tab / semicolon columns, matchday first)
// Dates are DD/MM/YYYY or DD/MM (current season year), times are HH:MM or HHhMM.

export interface ImportClub { id: number; name: string }
export interface ParsedRow { line: number; text: string; matchday: number | null; homeTeamId: number | null; awayTeamId: number | null; date: string | null; time: string | null; venue: string | null; errors: string[] }

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

const lev = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** Club whose name best matches the text: exact, then contained, then close spelling. Ambiguous or weak matches return null. */
export function matchClub(text: string, clubs: ImportClub[]): ImportClub | null {
  const t = norm(text)
  if (!t) return null
  const n = clubs.map(c => ({ c, k: norm(c.name) }))
  const exact = n.filter(x => x.k === t)
  if (exact.length === 1) return exact[0].c
  const within = n.filter(x => x.k.includes(t) || t.includes(x.k))
  if (within.length === 1) return within[0].c
  const scored = n.map(x => ({ c: x.c, s: lev(t, x.k) / Math.max(t.length, x.k.length) })).sort((a, b) => a.s - b.s)
  if (scored[0] && scored[0].s <= 0.25 && (!scored[1] || scored[1].s - scored[0].s > 0.1)) return scored[0].c
  return null
}

const HEAD = /^\s*(?:matchday|match day|journee|journée|jornada|round|j|الجولة|جولة)\s*[:.\-]?\s*(\d{1,2})\b[^\d]*$/i
const SEP = /\s+(?:-|–|—|vs\.?|v|x|ضد)\s+/i
const DATE = /\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b/
const TIME = /\b(\d{1,2})\s*[:hH]\s*(\d{2})\b/

const pad = (n: number) => String(n).padStart(2, '0')
function readDate(s: string, defaultYear: number, startMonth: number) {
  const m = DATE.exec(s)
  if (!m) return null
  const d = +m[1], mo = +m[2]; let y = m[3] ? +m[3] : defaultYear + (mo < startMonth ? 1 : 0) // season Dec 2026 - Mar 2027: "15/02" is 2027
  if (y < 100) y += 2000
  const t = new Date(y, mo - 1, d)
  if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d) return { bad: true as const, m }
  return { bad: false as const, iso: `${y}-${pad(mo)}-${pad(d)}`, m }
}

export function parseCalendar(text: string, clubs: ImportClub[], defaultYear: number, startMonth = 1): ParsedRow[] {
  const rows: ParsedRow[] = []
  let day: number | null = null
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim()
    if (!line) return
    const h = HEAD.exec(line)
    if (h) { day = +h[1]; return }
    const row: ParsedRow = { line: idx + 1, text: line, matchday: day, homeTeamId: null, awayTeamId: null, date: null, time: null, venue: null, errors: [] }
    let homeTxt = '', awayTxt = '', rest = ''
    const cols = line.split(/\t|;/).map(c => c.trim())
    if (cols.length >= 3) {
      let c = cols
      if (/^\d{1,2}$/.test(c[0])) { row.matchday = +c[0]; c = c.slice(1) }
      ;[homeTxt, awayTxt] = c; rest = c.slice(2).join(' ')
    } else {
      // cut the date/time off, what stands before them is "home - away", after them the venue
      const dm = DATE.exec(line), tm = TIME.exec(line)
      const cut = Math.min(dm ? dm.index : line.length, tm ? tm.index : line.length)
      const names = line.slice(0, cut).trim(); rest = line.slice(cut)
      const parts = names.split(SEP)
      if (parts.length === 2) { homeTxt = parts[0]; awayTxt = parts[1] } else row.errors.push('format')
    }
    if (!row.errors.length) {
      const hc = matchClub(homeTxt, clubs), ac = matchClub(awayTxt, clubs)
      if (!hc) row.errors.push(`club:${homeTxt.trim()}`)
      if (!ac) row.errors.push(`club:${awayTxt.trim()}`)
      row.homeTeamId = hc?.id ?? null; row.awayTeamId = ac?.id ?? null
      if (hc && ac && hc.id === ac.id) row.errors.push('sameClub')
    }
    const d = readDate(rest, defaultYear, startMonth)
    if (d?.bad) row.errors.push('date'); else if (d) row.date = d.iso
    const tm = TIME.exec(rest)
    if (tm) { const hh = +tm[1], mm = +tm[2]; if (hh > 23 || mm > 59) row.errors.push('time'); else row.time = `${pad(hh)}:${pad(mm)}` }
    const venue = rest.replace(DATE, ' ').replace(TIME, ' ').replace(/\s+/g, ' ').trim()
    row.venue = venue && /\p{L}/u.test(venue) ? venue.slice(0, 120) : null
    if (row.matchday == null) row.errors.push('matchday')
    rows.push(row)
  })
  // a club can only play once per matchday
  const seen = new Map<string, number>()
  for (const r of rows) {
    if (r.matchday == null || r.homeTeamId == null || r.awayTeamId == null) continue
    for (const id of [r.homeTeamId, r.awayTeamId]) {
      const k = `${r.matchday}:${id}`
      if (seen.has(k)) r.errors.push(`twice:${id}`); else seen.set(k, r.line)
    }
  }
  return rows
}
