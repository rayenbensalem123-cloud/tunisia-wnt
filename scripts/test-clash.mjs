import assert from 'node:assert/strict'
import { rangesOverlap, clashingCamps } from '../lib/clash.ts'

assert.equal(rangesOverlap('2026-11-01', '2026-11-05', '2026-11-05', '2026-11-08'), true)   // touching day counts
assert.equal(rangesOverlap('2026-11-01', '2026-11-05', '2026-11-06', '2026-11-08'), false)
assert.equal(rangesOverlap('2026-11-03', '', '2026-11-01', '2026-11-05'), true)             // start-only = one day
assert.equal(rangesOverlap('', '', '2026-11-01', '2026-11-05'), false)                     // undated never clashes

const a = { id: 1, name: 'A', startDate: '2026-11-01', endDate: '2026-11-05', players: [7], staff: [] }
const b = { id: 2, name: 'B', startDate: '2026-11-04', endDate: '2026-11-09', players: [7, 8], staff: [3] }
const c = { id: 3, name: 'C', startDate: '2026-12-01', endDate: '2026-12-03', players: [7], staff: [] }
assert.deepEqual(clashingCamps(a, [a, b, c], 7).map(x => x.id), [2])   // not itself, not the December one
assert.deepEqual(clashingCamps(a, [a, b, c], 8).map(x => x.id), [2])
assert.deepEqual(clashingCamps(a, [a, b, c], 9), [])
assert.deepEqual(clashingCamps({ ...a, id: undefined }, [b], 3).map(x => x.id), [2]) // unsaved draft, staff member
console.log('clash tests passed')
