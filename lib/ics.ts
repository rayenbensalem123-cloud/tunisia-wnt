export type CampRow = {
  id: number; name: string | null; location: string | null
  start_date: string | null; end_date: string | null; team_category: string | null
  players: unknown; staff: unknown; updated_at: string | null
}

const asIds = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [])

// Strict per-person scoping: a player sees only camps listing her id in
// `players`, staff only camps listing theirs in `staff`. Not called up = nothing.
// Admins see every camp (they already see all of them in the app).
export function campsForMember(camps: CampRow[], role: string, memberId: number | null): CampRow[] {
  if (role === 'admin') return camps
  if (memberId == null) return []
  const key = role === 'player' ? 'players' : 'staff'
  return camps.filter(c => asIds(c[key]).includes(memberId))
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// RFC 5545: fold lines at 75 octets (approximated by chars; fine for typical names)
const fold = (l: string) => l.replace(/(.{73})(?=.)/g, '$1\r\n ')
const ymd = (s: string) => s.replace(/-/g, '')
const validDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const addDay = (s: string) => {
  const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const stamp = (iso: string | null) => (iso ? new Date(iso) : new Date()).toISOString().replace(/[-:]|\.\d{3}/g, '')

export function buildCampsIcs(camps: CampRow[]): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tunisia WNT//Camps//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Tunisia WNT Camps',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ]
  for (const c of camps) {
    if (!validDate(c.start_date)) continue // undated camps can't be placed on a calendar
    const end = validDate(c.end_date) && c.end_date >= c.start_date ? c.end_date : c.start_date
    lines.push(
      'BEGIN:VEVENT',
      `UID:camp-${c.id}@tunisia-wnt`,
      `DTSTAMP:${stamp(c.updated_at)}`,
      `DTSTART;VALUE=DATE:${ymd(c.start_date)}`,
      `DTEND;VALUE=DATE:${ymd(addDay(end))}`, // all-day, end is exclusive
      `SUMMARY:${esc(c.name || 'National camp')}`,
    )
    if (c.location) lines.push(`LOCATION:${esc(c.location)}`)
    if (c.team_category) lines.push(`DESCRIPTION:${esc(c.team_category)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
