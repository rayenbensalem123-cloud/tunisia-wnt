/** Category helpers shared by the roster lists, card badges and tests. */

export type TeamCategory = 'SENIORS' | 'U20' | 'U17' | 'LIGUE'
export const CATEGORIES: TeamCategory[] = ['SENIORS', 'U20', 'U17', 'LIGUE']

/** Categories of a member, primary first, without duplicates. */
export function memberCategories(m: any): string[] {
  const extra = Array.isArray(m?.otherCategories) ? m.otherCategories : []
  return [m?.teamCategory, ...extra].filter((c): c is string => !!c && CATEGORIES.includes(c as TeamCategory))
    .filter((c, i, all) => all.indexOf(c) === i)
}

/** True when a member should be listed in this category (primary or added). */
export function inCategory(m: any, category: string | null): boolean {
  return !!category && memberCategories(m).includes(category)
}

/** The categories to show as a badge when viewing a given category. */
export function otherCategories(m: any, current: string | null): string[] {
  return memberCategories(m).filter((c) => c !== current)
}

export function categoryLabel(c: string | null): string {
  if (!c) return ''
  if (c === 'SENIORS') return 'SENIORS'
  if (c === 'U20') return 'U-20'
  if (c === 'U17') return 'U-17'
  if (c === 'LIGUE') return 'LIGUE FÉMININE'
  return c
}
