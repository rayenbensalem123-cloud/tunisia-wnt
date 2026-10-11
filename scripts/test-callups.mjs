import assert from 'node:assert/strict'
import { matchCallups } from '../lib/callups.ts'

const people = [
  { id: 1, name: 'Maryem Houij', role: 'PLAYERS' },
  { id: 2, name: 'Sara Ben Ali', role: 'PLAYERS' },
  { id: 3, name: 'Sara Gharbi', role: 'PLAYERS' },
  { id: 4, name: 'Ines Chebbi', role: 'PLAYERS' },
  { id: 5, name: 'Sabri Ghanem', role: 'COACHES', position: 'HEAD COACH' },
  { id: 6, name: 'Émilie Trabelsi', role: 'PLAYERS' },
]
const r = matchCallups([
  'GOALKEEPERS', 'N° Name Club',
  '9 HOUIJ Maryem FWD Paris FC',
  'Gharbi Sara 14 DEF',
  '12 Ines CHEBBI | 7 Emilie Trabelsi',
  'Sabri Ghanem Head Coach',
  'Mariem Houij',            // typo twin of #1, same player -> still one entry
  'Nour Unknown Player',
  '3 Sara',                  // ambiguous first name only -> not guessed
], people)
assert.deepEqual(r.players.sort(), [1, 3, 4, 6])
assert.deepEqual(r.staff, [{ id: 5, role: 'HEAD COACH' }])
assert.ok(r.unmatched.includes('Nour Unknown Player'))
assert.ok(!r.players.includes(2), 'ambiguous "Sara" must not pick Sara Ben Ali')
console.log('callups ok')
