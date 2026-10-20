// Suspensions from cards. Pure, no imports.
// Assumed rules (change RULES if the federation's differ):
//   - a red card is a ban for the club's next match
//   - every third yellow card in the season (3rd, 6th, 9th ...) is a ban for the club's next match
export const RULES = { yellowsForBan: 3 }

interface Fx { id: number; matchday: number; kickoff: string | null; status: string; homeTeamId: number; awayTeamId: number }
interface Ev { fixtureId: number; teamId: number; memberId: number; playerName: string; kind: string }
export interface Suspension { memberId: number; teamId: number; name: string; reason: 'red' | 'yellows'; triggerFixtureId: number; fixtureId: number; matchday: number }

const order = (a: Fx, b: Fx) => a.matchday - b.matchday || (a.kickoff ?? '').localeCompare(b.kickoff ?? '') || a.id - b.id

/** Every ban, with the match it must be served in (null target = the club has no later match yet, so no ban is listed). */
export function computeSuspensions(fixtures: Fx[], events: Ev[]): Suspension[] {
  const fx = new Map(fixtures.map(f => [f.id, f]))
  const out: Suspension[] = []
  const nextOf = (teamId: number, after: Fx) =>
    fixtures.filter(f => f.status !== 'postponed' && (f.homeTeamId === teamId || f.awayTeamId === teamId) && f.matchday > after.matchday).sort(order)[0] ?? null
  const add = (e: Ev, reason: Suspension['reason'], trigger: Fx) => {
    const target = nextOf(e.teamId, trigger)
    if (target) out.push({ memberId: e.memberId, teamId: e.teamId, name: e.playerName, reason, triggerFixtureId: trigger.id, fixtureId: target.id, matchday: target.matchday })
  }
  const cards = events.filter(e => (e.kind === 'yellow' || e.kind === 'red') && fx.get(e.fixtureId)?.status === 'played')
    .sort((a, b) => order(fx.get(a.fixtureId)!, fx.get(b.fixtureId)!))
  const yellows = new Map<number, number>()
  for (const e of cards) {
    const f = fx.get(e.fixtureId)!
    if (e.kind === 'red') add(e, 'red', f)
    else {
      const n = (yellows.get(e.memberId) ?? 0) + 1
      yellows.set(e.memberId, n)
      if (n % RULES.yellowsForBan === 0) add(e, 'yellows', f)
    }
  }
  // one ban per player per match
  const seen = new Set<string>()
  return out.filter(s => { const k = `${s.memberId}:${s.fixtureId}`; if (seen.has(k)) return false; seen.add(k); return true })
}

/** Bans a club must serve in a given match. */
export const suspendedFor = (all: Suspension[], fixtureId: number, teamId: number) => all.filter(s => s.fixtureId === fixtureId && s.teamId === teamId)
