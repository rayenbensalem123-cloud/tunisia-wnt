// Passport validity checks. Pure functions, no I/O.
// Most countries require a passport to be valid for at least 6 months beyond the
// date of travel, so that is the default margin.

export const MIN_VALID_MONTHS = 6

export type PassportStatus =
  | { status: 'missing' }                              // no expiry date recorded
  | { status: 'expired'; daysLeft: number }            // already expired (daysLeft <= 0)
  | { status: 'short'; daysLeft: number }              // valid, but not for 6 months after `reference`
  | { status: 'ok'; daysLeft: number }

const ISO = /^\d{4}-\d{2}-\d{2}$/
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

export function addMonthsIso(iso: string, months: number): string {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10)
  const t = new Date(Date.UTC(y, m + months, 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  t.setUTCDate(Math.min(d, last))
  return t.toISOString().slice(0, 10)
}

/**
 * `reference` is the date the passport must still be valid at (+ margin):
 * today for a general check, or a trip's return date for a specific camp/match.
 */
export function passportStatus(expiry: string | null | undefined, reference: string, minMonths = MIN_VALID_MONTHS): PassportStatus {
  if (!expiry || !ISO.test(expiry) || !ISO.test(reference)) return { status: 'missing' }
  const daysLeft = Math.round((toUtc(expiry) - toUtc(reference)) / 86400000)
  if (daysLeft < 0 || expiry < reference) return { status: 'expired', daysLeft }
  if (expiry < addMonthsIso(reference, minMonths)) return { status: 'short', daysLeft }
  return { status: 'ok', daysLeft }
}
