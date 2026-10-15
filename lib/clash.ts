// Camp date clashes. Pure functions, no I/O.

export interface CampLike { id?: number; name: string; startDate: string; endDate: string; players: number[]; staff?: number[] }

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Inclusive date ranges overlap. A camp with only a start date is treated as one day. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  if (!ISO.test(aStart) || !ISO.test(bStart)) return false
  const ae = ISO.test(aEnd) && aEnd >= aStart ? aEnd : aStart
  const be = ISO.test(bEnd) && bEnd >= bStart ? bEnd : bStart
  return aStart <= be && bStart <= ae
}

/** Other camps (not `draft` itself) that overlap its dates and also call up this member as player or staff. */
export function clashingCamps(draft: CampLike, others: CampLike[], memberId: number): CampLike[] {
  return others.filter(c =>
    (draft.id == null || c.id !== draft.id) &&
    ((c.players || []).includes(memberId) || (c.staff || []).includes(memberId)) &&
    rangesOverlap(draft.startDate, draft.endDate, c.startDate, c.endDate))
}
