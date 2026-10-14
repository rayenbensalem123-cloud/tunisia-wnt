import assert from 'node:assert/strict'
import { campsForMember, buildCampsIcs } from '../lib/ics.ts'
const camps = [
  { id: 1, name: 'Camp A', location: 'Tunis', start_date: '2026-11-01', end_date: '2026-11-05', team_category: 'SENIORS', players: [7, 9], staff: [3], updated_at: null },
  { id: 2, name: 'Camp B', location: 'Sousse', start_date: '2026-12-01', end_date: '2026-12-03', team_category: 'U20', players: [8], staff: [4], updated_at: null },
]
assert.deepEqual(campsForMember(camps, 'player', 7).map(c => c.id), [1])
assert.deepEqual(campsForMember(camps, 'player', 99), [])
assert.deepEqual(campsForMember(camps, 'staff', 4).map(c => c.id), [2])
assert.deepEqual(campsForMember(camps, 'staff', 7), []) // a player id in staff role must not match players list
assert.deepEqual(campsForMember(camps, 'player', null), [])
assert.equal(campsForMember(camps, 'admin', null).length, 2)
const ics = buildCampsIcs(campsForMember(camps, 'player', 7))
assert.ok(ics.includes('Camp A') && !ics.includes('Camp B'))
assert.ok(ics.includes('DTEND;VALUE=DATE:20261106'))
console.log('ics tests passed')
