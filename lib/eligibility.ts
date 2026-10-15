// Birthdays and youth age-group eligibility. Pure functions, no I/O.
//
// Rule used (FIFA / CAF youth women's competitions): a player is eligible for an
// Under-N tournament if she turns at most N during the tournament's calendar year,
// i.e. (tournament year - birth year) <= N. The year is a parameter because the
// qualifiers for a tournament can fall in a different year than the finals;
// always confirm against the competition's own regulations.

export const AGE_LIMITS: Record<string, number> = { U17: 17, U20: 20 }

export type Eligibility =
  | { status: 'na' }                              // Seniors: no age limit
  | { status: 'unknown' }                         // no usable birthdate on file
  | { status: 'ok'; ageInYear: number }
  | { status: 'ageing_out'; ageInYear: number }   // eligible this year, too old next year
  | { status: 'over'; ageInYear: number }         // already too old for the chosen year

export interface Birth { d: number; m: number; y: number }

/** Birthdates are stored as DD/MM/YYYY text. Returns null for anything else. */
export function parseBirthdate(s: string | null | undefined): Birth | null {
  const mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim())
  if (!mt) return null
  const d = +mt[1], m = +mt[2], y = +mt[3]
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  if (y < 1950 || y > 2100) return null
  return { d, m, y }
}

export function eligibilityFor(birthdate: string | null | undefined, category: string, year: number): Eligibility {
  const limit = AGE_LIMITS[category]
  if (limit === undefined) return { status: 'na' }
  const b = parseBirthdate(birthdate)
  if (!b) return { status: 'unknown' }
  const ageInYear = year - b.y
  if (ageInYear > limit) return { status: 'over', ageInYear }
  if (ageInYear === limit) return { status: 'ageing_out', ageInYear }
  return { status: 'ok', ageInYear }
}

export interface BirthdayItem { id: number; name: string; day: number; month: number; turning: number; daysAway: number }

/** Birthdays in the next `withinDays` days (today included), soonest first. Feb 29 is celebrated on Feb 28 in non-leap years. */
export function upcomingBirthdays(
  people: { id: number; name: string; birthdate?: string | null }[],
  today: Date,
  withinDays = 30,
): BirthdayItem[] {
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const out: BirthdayItem[] = []
  for (const p of people) {
    const b = parseBirthdate(p.birthdate)
    if (!b) continue
    for (const yr of [today.getFullYear(), today.getFullYear() + 1]) {
      const leap = new Date(Date.UTC(yr, 1, 29)).getUTCMonth() === 1
      const day = b.m === 2 && b.d === 29 && !leap ? 28 : b.d
      const daysAway = Math.round((Date.UTC(yr, b.m - 1, day) - t0) / 86400000)
      if (daysAway >= 0 && daysAway <= withinDays) {
        out.push({ id: p.id, name: p.name, day, month: b.m, turning: yr - b.y, daysAway })
        break
      }
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name))
}
