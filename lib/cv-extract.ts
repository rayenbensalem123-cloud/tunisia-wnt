// Turns the raw JSON an AI model returned for a CV into values that are safe to put
// in the player-card form. The model's output is UNTRUSTED (a CV can contain text that
// tries to steer it), so every field is validated, capped and mapped to the form's own
// vocabulary here; anything that doesn't fit is dropped rather than guessed.

// Same DD/MM/YYYY rule as lib/eligibility.ts (kept local so this file has no sibling imports).
function parseBirthdate(s: string): { d: number; m: number; y: number } | null {
  const mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (!mt) return null
  const d = +mt[1], m = +mt[2], y = +mt[3]
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1950 ? { d, m, y } : null
}

export const CV_LANGUAGES = ['ARABIC', 'FRENCH', 'ENGLISH', 'ITALIAN', 'SPANISH', 'GERMAN', 'PORTUGUESE']
export const CV_COACH_POSITIONS = ['HEAD COACH', 'ASSISTANT COACH', 'GOALKEEPER COACH', 'FITNESS COACH', 'MEDICAL STAFF', 'TECHNICAL DIRECTOR', 'ANALYST']

export type CvRole = 'PLAYERS' | 'COACHES'
export interface CvFields {
  name?: string; club?: string; position?: string; birthdate?: string; height?: string
  nationality?: string; secondNationality?: string; dualNationality?: boolean; languages?: string
  natMatches?: string; goals?: string; assists?: string; cleansheets?: number; jerseyNumber?: string
  contract?: string; leagueRegion?: string
}
export interface CvResult { fields: CvFields; history: { year: string; event: string }[] }

 
const clean = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : undefined
}
const int = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,4}$/.test(v.trim()) ? Number(v) : NaN
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
}

export function mapPlayerPosition(v: unknown): string | undefined {
  const s = (clean(v, 40) || '').toLowerCase()
  if (!s) return undefined
  if (/goal\s*keeper|\bgk\b|keeper/.test(s)) return 'GOALKEEPER'
  if (/mid|\b(cm|dm|am|mf|cdm|cam)\b/.test(s)) return 'MIDFIELDER'   // before defender: "defensive midfielder"
  if (/defen|back|\b(cb|lb|rb|df)\b/.test(s)) return 'DEFENDER'
  if (/forward|striker|wing|attack|\b(fw|cf|st|lw|rw)\b/.test(s)) return 'FORWARD'
  return undefined
}

export function mapCoachPosition(v: unknown): string | undefined {
  const s = (clean(v, 60) || '').toUpperCase()
  if (!s) return undefined
  if (/GOALKEEPER|GK/.test(s) && /COACH|TRAINER/.test(s)) return 'GOALKEEPER COACH'
  if (/ASSISTANT/.test(s)) return 'ASSISTANT COACH'
  if (/HEAD|MANAGER|\bCOACH\b/.test(s) && !/FITNESS|PHYSICAL|CONDITION/.test(s)) return 'HEAD COACH'
  if (/FITNESS|PHYSICAL|CONDITION/.test(s)) return 'FITNESS COACH'
  if (/MEDIC|DOCTOR|PHYSIO|NURSE/.test(s)) return 'MEDICAL STAFF'
  if (/TECHNICAL DIRECTOR|SPORTING DIRECTOR|DTN/.test(s)) return 'TECHNICAL DIRECTOR'
  if (/ANALYST|ANALYSIS/.test(s)) return 'ANALYST'
  return undefined
}

/** Accepts DD/MM/YYYY or YYYY-MM-DD; returns DD/MM/YYYY (the card's format) only for a real date. */
export function normalizeBirthdate(v: unknown): string | undefined {
  const s = clean(v, 20)
  if (!s) return undefined
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  const candidate = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : s
  const b = parseBirthdate(candidate)
  if (!b) return undefined
  if (b.y > new Date().getFullYear() - 5) return undefined // not a plausible roster age
  return `${String(b.d).padStart(2, '0')}/${String(b.m).padStart(2, '0')}/${b.y}`
}

export function normalizeHeightCm(v: unknown): string | undefined {
  const raw = typeof v === 'number' ? String(v) : clean(v, 20)
  if (!raw) return undefined
  const m = /(\d+(?:[.,]\d+)?)/.exec(raw)
  if (!m) return undefined
  let n = Number(m[1].replace(',', '.'))
  if (n > 0 && n < 3) n = Math.round(n * 100) // metres -> cm
  n = Math.round(n)
  return n >= 120 && n <= 220 ? String(n) : undefined
}

export function sanitizeCv(raw: any, role: CvRole): CvResult {
  const r = raw && typeof raw === 'object' ? raw : {}
  const f: CvFields = {}
  const set = <K extends keyof CvFields>(k: K, v: CvFields[K] | undefined) => { if (v !== undefined) f[k] = v }

  set('name', clean(r.name, 80))
  set('club', clean(r.currentClub, 80))
  set('position', role === 'PLAYERS' ? mapPlayerPosition(r.position) : mapCoachPosition(r.position))
  set('birthdate', normalizeBirthdate(r.birthdate))
  set('height', role === 'PLAYERS' ? normalizeHeightCm(r.heightCm) : undefined)
  set('nationality', clean(r.nationality, 60))
  const second = clean(r.secondNationality, 60)
  if (second && second.toLowerCase() !== (f.nationality || '').toLowerCase()) { f.secondNationality = second; f.dualNationality = true }
  if (Array.isArray(r.languages)) {
    const set2 = new Set<string>()
    for (const l of r.languages) { const u = (clean(l, 30) || '').toUpperCase(); if (CV_LANGUAGES.includes(u)) set2.add(u) }
    if (set2.size) f.languages = [...set2].join(', ')
  }
  if (role === 'PLAYERS') {
    const caps = int(r.nationalTeamCaps, 0, 999); if (caps !== undefined) f.natMatches = String(caps)
    const goals = int(r.goals, 0, 999); if (goals !== undefined) f.goals = String(goals)
    const assists = int(r.assists, 0, 999); if (assists !== undefined) f.assists = String(assists)
    const cs = int(r.cleanSheets, 0, 999); if (cs !== undefined) f.cleansheets = cs
    const jn = int(r.jerseyNumber, 1, 99); if (jn !== undefined) f.jerseyNumber = String(jn)
  }
  set('contract', clean(r.contract, 100))
  set('leagueRegion', clean(r.leagueRegion, 80))

  const history: { year: string; event: string }[] = []
  const seen = new Set<string>()
  if (Array.isArray(r.career)) {
    for (const h of r.career.slice(0, 40)) {
      const year = clean(h?.years, 12)
      const event = clean(h?.team, 120)
      if (!year || !event || !/\d{4}/.test(year)) continue
      const key = `${year}|${event.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key); history.push({ year, event })
      if (history.length >= 30) break
    }
  }
  return { fields: f, history }
}

const isEmptyValue = (v: unknown) => v === undefined || v === null || v === '' || v === 0 || v === false

export interface CvMerge { form: any; filled: string[]; kept: string[]; historyAdded: number }

/**
 * Applies a CV result to the card form. By default only EMPTY fields are filled, so
 * nothing a person already typed is overwritten; `replace` lets the CV win instead.
 * History entries are added (never duplicated); with `replace` they replace the list.
 */
export function mergeCvIntoForm(form: any, result: CvResult, replace = false): CvMerge {
  const next = { ...form }
  const filled: string[] = []
  const kept: string[] = []
  for (const [k, v] of Object.entries(result.fields)) {
    if (k === 'dualNationality') continue // follows secondNationality
    if (replace || isEmptyValue(next[k])) {
      next[k] = v
      filled.push(k)
      if (k === 'secondNationality') next.dualNationality = true
    } else if (String(next[k]) !== String(v)) kept.push(k)
  }
  let historyAdded = 0
  const existing: { year: string; event: string }[] = Array.isArray(next.history) ? next.history.filter((h: any) => h && (h.year || h.event)) : []
  if (result.history.length) {
    if (replace) { next.history = result.history.map(h => ({ ...h })); historyAdded = result.history.length }
    else {
      const have = new Set(existing.map(h => `${String(h.year).trim()}|${String(h.event).trim().toLowerCase()}`))
      const add = result.history.filter(h => !have.has(`${h.year}|${h.event.toLowerCase()}`))
      next.history = [...existing, ...add.map(h => ({ ...h }))]
      historyAdded = add.length
    }
  }
  return { form: next, filled, kept, historyAdded }
}
