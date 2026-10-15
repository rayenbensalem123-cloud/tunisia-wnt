import assert from 'node:assert/strict'
import { parseBirthdate, eligibilityFor, upcomingBirthdays } from '../lib/eligibility.ts'
import { passportStatus, addMonthsIso } from '../lib/documents.ts'

// birthdate parsing
assert.deepEqual(parseBirthdate('18/02/2006'), { d: 18, m: 2, y: 2006 })
assert.equal(parseBirthdate('31/02/2006'), null)
assert.equal(parseBirthdate('2006-02-18'), null)
assert.equal(parseBirthdate(null), null)

// eligibility: U20 in 2028 -> born 2008 or later eligible; 2008 is the oldest allowed
assert.equal(eligibilityFor('01/01/2009', 'U20', 2028).status, 'ok')
assert.equal(eligibilityFor('31/12/2008', 'U20', 2028).status, 'ageing_out')
assert.equal(eligibilityFor('01/01/2007', 'U20', 2028).status, 'over')
assert.equal(eligibilityFor('01/01/2011', 'U17', 2028).status, 'ageing_out')
assert.equal(eligibilityFor('01/01/2010', 'U17', 2028).status, 'over')
assert.equal(eligibilityFor(null, 'U17', 2028).status, 'unknown')
assert.equal(eligibilityFor('01/01/1990', 'SENIORS', 2028).status, 'na')

// birthdays
const ppl = [
  { id: 1, name: 'A', birthdate: '20/10/2006' },
  { id: 2, name: 'B', birthdate: '15/10/2001' },   // today
  { id: 3, name: 'C', birthdate: '05/01/2000' },   // across the year end
  { id: 4, name: 'D', birthdate: '29/02/2004' },   // leap day
  { id: 5, name: 'E', birthdate: null },
]
const r = upcomingBirthdays(ppl, new Date(2026, 9, 15), 90)
assert.deepEqual(r.map(x => x.id), [2, 1, 3])
assert.equal(r[0].daysAway, 0); assert.equal(r[0].turning, 25)
assert.equal(r[2].turning, 27)
const feb = upcomingBirthdays(ppl, new Date(2027, 1, 20), 10)
assert.deepEqual(feb.map(x => [x.id, x.day]), [[4, 28]])

// passports
assert.equal(addMonthsIso('2026-08-31', 6), '2027-02-28')
assert.equal(passportStatus(null, '2026-10-15').status, 'missing')
assert.equal(passportStatus('2026-10-01', '2026-10-15').status, 'expired')
assert.equal(passportStatus('2027-02-01', '2026-10-15').status, 'short')
assert.equal(passportStatus('2027-04-15', '2026-10-15').status, 'ok')
assert.equal(passportStatus('2027-04-14', '2026-10-15').status, 'short')
console.log('eligibility + documents tests passed')
