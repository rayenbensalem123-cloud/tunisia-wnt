import assert from 'node:assert/strict'
import { parseCampList } from '../lib/camp-list.ts'

// Section headers carry the camp down to the rows that follow them.
const full = parseCampList([
  'CAMP MARCH 2026 — TUNIS',
  'No. Name | Club',
  '1. Sara Ben Ali, Espérance',
  '2. Aïcha Trabelsi, ASFAR',
  'Page 1/3',
  'STAGE U20 JULY — 12/07/2026',
  'Lina Khelifi | Stade Tunisien',
  'contact@ftf.tn',
], ['Camp March 2026'])
assert.deepEqual(full, [
  { name: 'Sara Ben Ali', team: 'Espérance', camp: 'Camp March 2026' },
  { name: 'Aïcha Trabelsi', team: 'ASFAR', camp: 'Camp March 2026' },
  { name: 'Lina Khelifi', team: 'Stade Tunisien', camp: 'STAGE U20 JULY — 12/07/2026' },
])

// Camp in a column, with a semicolon-separated sheet export.
const columns = parseCampList([
  'Name;Club;Camp',
  'Sara Ben Ali;Espérance;Stage November',
  'Nour Dridi;Club Africain;Stage November',
], [])
assert.deepEqual(columns, [
  { name: 'Sara Ben Ali', team: 'Espérance', camp: 'Stage November' },
  { name: 'Nour Dridi', team: 'Club Africain', camp: 'Stage November' },
])

// An existing camp is recognised despite accents/case; duplicates are dropped.
const known = parseCampList([
  'RASSEMBLEMENT FEVRIER 2026',
  'Inès Jemmali, ASFAR',
  'INÈS JEMMALI, ASFAR',
], ['Rassemblement Février 2026'])
assert.equal(known.length, 1)
assert.equal(known[0].camp, 'Rassemblement Février 2026')

// Arabic names and a plain one-per-line list survive (no ASCII-only matching).
const arabic = parseCampList(['معسكر مارس', 'ليلى بن علي, النادي الإفريقي'], [])
assert.deepEqual(arabic, [{ name: 'ليلى بن علي', team: 'النادي الإفريقي', camp: 'معسكر مارس' }])

console.log('Camp list parser tests passed.')
