import assert from 'node:assert/strict'
import { parseResult, summarize } from '../lib/match-stats.ts'

assert.deepEqual(parseResult('2-1'), { gf: 2, ga: 1 })
assert.deepEqual(parseResult(' 0 – 0 (4-3 pens)'), { gf: 0, ga: 0 })
assert.equal(parseResult(''), null)
assert.equal(parseResult(undefined), null)
assert.equal(parseResult('postponed'), null)

const ms = [
  { id: 1, opponent: 'Egypt', date: '2026-03-01', competition: 'Friendly', result: '2-1' },
  { id: 2, opponent: 'Ghana', date: '2025-11-10', competition: 'AFCON Q', result: '0-0' },
  { id: 3, opponent: 'Mali', date: '2026-06-05', competition: 'AFCON Q', result: '1-3' },
  { id: 4, opponent: 'Kenya', date: '2026-09-01', competition: 'Friendly', result: '' },     // not played
]
const all = summarize(ms)
assert.equal(all.played, 3)
assert.deepEqual([all.w, all.d, all.l, all.gf, all.ga, all.winRate], [1, 1, 1, 3, 4, 33])
assert.deepEqual(all.series.map(s => s.opponent), ['Ghana', 'Egypt', 'Mali'])   // chronological
assert.deepEqual(all.competitions, ['AFCON Q', 'Friendly'])
assert.deepEqual(all.years, [2026, 2025])
const q = summarize(ms, { competition: 'AFCON Q', year: 2026 })
assert.deepEqual([q.played, q.l], [1, 1])
assert.equal(summarize([]).winRate, 0)
console.log('match-stats tests passed')
