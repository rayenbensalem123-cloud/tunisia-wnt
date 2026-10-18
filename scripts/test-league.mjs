import assert from 'node:assert/strict'
import { computeStandings } from '../lib/league-standings.ts'
import { generateRoundRobin, matchdayDate, shuffled } from '../lib/league-schedule.ts'

// ── standings ───────────────────────────────────────────
const teams = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }, { id: 4, name: 'D' }]
const fx = (matchday, h, a, hg, ag, status = 'played') => ({ matchday, homeTeamId: h, awayTeamId: a, status, homeGoals: hg, awayGoals: ag })
const table = computeStandings(teams, [
  fx(1, 1, 2, 2, 0),            // A beats B
  fx(1, 3, 4, 1, 1),            // C draws D
  fx(2, 2, 3, 0, 3),            // C beats B
  fx(2, 4, 1, 1, 2),            // A beats D
  fx(3, 1, 3, null, null, 'scheduled'), // not played: ignored
  fx(3, 2, 4, null, null, 'postponed'),
])
const by = Object.fromEntries(table.map(r => [r.name, r]))
assert.deepEqual([by.A.played, by.A.won, by.A.points, by.A.gf, by.A.ga, by.A.gd], [2, 2, 6, 4, 1, 3])
assert.deepEqual([by.C.played, by.C.won, by.C.drawn, by.C.points, by.C.gd], [2, 1, 1, 4, 3])
assert.deepEqual([by.D.played, by.D.drawn, by.D.lost, by.D.points], [2, 1, 1, 1])
assert.deepEqual([by.B.played, by.B.lost, by.B.points, by.B.gd], [2, 2, 0, -5])
assert.deepEqual(table.map(r => r.name), ['A', 'C', 'D', 'B'])
assert.deepEqual(table.map(r => r.rank), [1, 2, 3, 4])
assert.deepEqual(by.A.form, ['W', 'W'])
assert.deepEqual(by.C.form, ['W', 'D'])           // most recent first
// total goals for == total goals against
assert.equal(table.reduce((s, r) => s + r.gf, 0), table.reduce((s, r) => s + r.ga, 0))

// tie-breaks: points, then goal difference, then goals for, then name; equal rows share a rank
const tie = computeStandings([{ id: 1, name: 'Y' }, { id: 2, name: 'X' }, { id: 3, name: 'Z' }, { id: 4, name: 'W' }], [
  fx(1, 1, 3, 1, 0), fx(1, 2, 4, 1, 0),   // Y and X both win 1-0
])
assert.deepEqual(tie.map(r => r.name), ['X', 'Y', 'W', 'Z'])
assert.deepEqual(tie.map(r => r.rank), [1, 1, 3, 3])
// unknown clubs in a fixture are ignored, no crash on empty input
assert.equal(computeStandings([], []).length, 0)
assert.equal(computeStandings(teams, [fx(1, 1, 99, 1, 0)])[0].played, 0)

// ── generator ───────────────────────────────────────────
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join('-')

for (const n of [2, 3, 4, 5, 8, 14]) {
  const ids = Array.from({ length: n }, (_, i) => i + 1)
  const single = generateRoundRobin(ids, { rand })
  const matchdays = n % 2 ? n : n - 1
  assert.equal(single.length, (n * (n - 1)) / 2, `single count n=${n}`)
  // every pair meets exactly once
  const seen = new Set(single.map(f => pairKey(f.homeTeamId, f.awayTeamId)))
  assert.equal(seen.size, single.length, `pairs unique n=${n}`)
  // nobody plays twice on the same matchday, matchdays are 1..matchdays
  for (let d = 1; d <= matchdays; d++) {
    const day = single.filter(f => f.matchday === d)
    const clubs = day.flatMap(f => [f.homeTeamId, f.awayTeamId])
    assert.equal(new Set(clubs).size, clubs.length, `one match per club per day n=${n} day=${d}`)
  }
  assert.ok(single.every(f => f.matchday >= 1 && f.matchday <= matchdays && f.homeTeamId !== f.awayTeamId))

  const dbl = generateRoundRobin(ids, { double: true, rand })
  assert.equal(dbl.length, n * (n - 1), `double count n=${n}`)
  // each ordered pair (home, away) exactly once -> every club hosts every other once
  assert.equal(new Set(dbl.map(f => `${f.homeTeamId}>${f.awayTeamId}`)).size, dbl.length)
  assert.equal(Math.max(...dbl.map(f => f.matchday)), matchdays * 2)
}
// 14 clubs: 26 matchdays, 182 matches, 7 matches a day; home/away balance within 1 per half
{
  const ids = Array.from({ length: 14 }, (_, i) => i + 1)
  const d = generateRoundRobin(ids, { double: true, rand })
  assert.equal(d.length, 182)
  assert.equal(Math.max(...d.map(f => f.matchday)), 26)
  for (const id of ids) {
    const home = d.filter(f => f.homeTeamId === id).length
    assert.equal(home, 13)
  }
}
// no club gets a long run of home or away games, and each half is roughly balanced
for (const n of [8, 10, 14]) {
  const ids = Array.from({ length: n }, (_, i) => i + 1)
  const dd = generateRoundRobin(ids, { double: true, rand })
  const days = n - 1
  let worst = 0
  for (const id of ids) {
    let run = 0, last = null
    for (let m = 1; m <= days * 2; m++) {
      const f = dd.find(x => x.matchday === m && (x.homeTeamId === id || x.awayTeamId === id))
      const home = f.homeTeamId === id
      run = home === last ? run + 1 : 1
      last = home
      worst = Math.max(worst, run)
    }
    const firstHome = dd.filter(f => f.matchday <= days && f.homeTeamId === id).length
    assert.ok(Math.abs(firstHome - days / 2) <= 1.5, `first-half home games for club ${id} n=${n}: ${firstHome}`)
  }
  assert.ok(worst <= 3, `home/away streak ${worst} for n=${n}`)
}
assert.deepEqual(generateRoundRobin([1]), [])
assert.deepEqual(generateRoundRobin([]), [])
assert.equal(generateRoundRobin([1, 1, 2]).length, 1)   // duplicates collapsed

// shuffle keeps the elements
assert.deepEqual([...shuffled([1, 2, 3, 4, 5], rand)].sort(), [1, 2, 3, 4, 5])

// ── matchday dates ──────────────────────────────────────
assert.equal(matchdayDate('2026-10-04', 1, 7), '2026-10-04')
assert.equal(matchdayDate('2026-10-04', 2, 7), '2026-10-11')
assert.equal(matchdayDate('2026-12-27', 3, 7), '2027-01-10')   // across the year end
assert.equal(matchdayDate('2028-02-27', 2, 2), '2028-02-29')   // leap day

console.log('league tests passed')

// ── cup ─────────────────────────────────────────────────
import { cupWinner, roundKey, nextFreeSlot } from '../lib/league-cup.ts'
const cm = (over) => ({ status: 'played', homeTeamId: 1, awayTeamId: 2, homeGoals: 2, awayGoals: 1, homePens: null, awayPens: null, ...over })
assert.equal(cupWinner(cm({})), 1)
assert.equal(cupWinner(cm({ homeGoals: 0, awayGoals: 3 })), 2)
assert.equal(cupWinner(cm({ homeGoals: 1, awayGoals: 1, homePens: 3, awayPens: 5 })), 2)
assert.equal(cupWinner(cm({ homeGoals: 1, awayGoals: 1, homePens: 5, awayPens: 3 })), 1)
assert.equal(cupWinner(cm({ homeGoals: 1, awayGoals: 1 })), null)                 // draw without penalties
assert.equal(cupWinner(cm({ status: 'scheduled', homeGoals: null, awayGoals: null })), null)
assert.equal(cupWinner(cm({ homeTeamId: null })), null)
assert.equal(roundKey(2), 'roundFinal'); assert.equal(roundKey(4), 'roundSemi'); assert.equal(roundKey(16), 'roundR16')
assert.equal(nextFreeSlot(8, [1, 2, 4]), 3)
assert.equal(nextFreeSlot(2, [1]), null)
assert.equal(nextFreeSlot(4, []), 1)
console.log('cup tests passed')

// ── next / last match ───────────────────────────────────
import { pickNext, pickLast } from '../lib/league-pick.ts'
const now = Date.parse('2026-10-20T12:00:00Z')
const pf = (id, md, h, a, status, kickoff) => ({ id, matchday: md, homeTeamId: h, awayTeamId: a, status, kickoff })
const fl = [
  pf(1, 1, 1, 2, 'played', '2026-10-04T14:00:00Z'),
  pf(2, 2, 3, 1, 'played', '2026-10-11T14:00:00Z'),
  pf(3, 3, 1, 4, 'scheduled', '2026-10-25T14:00:00Z'),
  pf(4, 4, 5, 1, 'scheduled', '2026-11-01T14:00:00Z'),
  pf(5, 3, 2, 3, 'scheduled', '2026-10-25T15:00:00Z'),
  pf(6, 5, 1, 6, 'postponed', null),
]
assert.equal(pickNext(fl, 1, now).id, 3)             // earliest upcoming, not the postponed one
assert.equal(pickNext(fl, 2, now).id, 5)
assert.equal(pickNext(fl, 9, now), null)
assert.equal(pickLast(fl, 1).id, 2)                  // most recent played
assert.equal(pickLast(fl, 4), null)
// undated fixtures: lowest matchday still to play
const und = [pf(1, 7, 1, 2, 'scheduled', null), pf(2, 6, 3, 1, 'scheduled', null)]
assert.equal(pickNext(und, 1, now).id, 2)
// a match that kicked off an hour ago still counts as "next" (not yet recorded), a day-old one does not
const recent = [pf(1, 1, 1, 2, 'scheduled', '2026-10-20T11:00:00Z'), pf(2, 2, 1, 3, 'scheduled', '2026-10-27T11:00:00Z')]
assert.equal(pickNext(recent, 1, now).id, 1)
const stale = [pf(1, 1, 1, 2, 'scheduled', '2026-10-18T11:00:00Z'), pf(2, 2, 1, 3, 'scheduled', '2026-10-27T11:00:00Z')]
assert.equal(pickNext(stale, 1, now).id, 2)
console.log('pick tests passed')
