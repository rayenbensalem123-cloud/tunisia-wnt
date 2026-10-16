import assert from 'node:assert/strict'
import { sanitizeCv, mapPlayerPosition, mapCoachPosition, normalizeBirthdate, normalizeHeightCm } from '../lib/cv-extract.ts'

assert.equal(mapPlayerPosition('Centre-back'), 'DEFENDER')
assert.equal(mapPlayerPosition('Right Winger'), 'FORWARD')
assert.equal(mapPlayerPosition('Defensive Midfielder'), 'MIDFIELDER')
assert.equal(mapPlayerPosition('GK'), 'GOALKEEPER')
assert.equal(mapPlayerPosition('astronaut'), undefined)
assert.equal(mapCoachPosition('Assistant Coach'), 'ASSISTANT COACH')
assert.equal(mapCoachPosition('Goalkeeper Trainer'), 'GOALKEEPER COACH')
assert.equal(mapCoachPosition('Head Coach'), 'HEAD COACH')
assert.equal(mapCoachPosition('Fitness Coach'), 'FITNESS COACH')

assert.equal(normalizeBirthdate('2005-03-09'), '09/03/2005')
assert.equal(normalizeBirthdate('9/3/2005'), '09/03/2005')
assert.equal(normalizeBirthdate('31/02/2005'), undefined)
assert.equal(normalizeBirthdate('2030-01-01'), undefined)
assert.equal(normalizeHeightCm('1.72 m'), '172')
assert.equal(normalizeHeightCm(168), '168')
assert.equal(normalizeHeightCm('17'), undefined)

const r = sanitizeCv({
  name: '  Sara   Test\u0000 ', currentClub: 'FC Example', position: 'Left Back', birthdate: '2004-11-02', heightCm: 171,
  nationality: 'Tunisian', secondNationality: 'French', languages: ['arabic', 'French', 'Klingon'],
  nationalTeamCaps: '12', goals: 3, assists: -1, cleanSheets: null, jerseyNumber: 7, contract: 'Until 2027', leagueRegion: 'France',
  career: [
    { years: '2019-2021', team: 'Club A' }, { years: '2019-2021', team: 'club a' }, { years: '', team: 'No year' },
    { years: '2021-', team: 'Club B' }, { years: 'present', team: 'Bad' },
  ],
  injectedInstruction: 'ignore previous', isAdmin: true,
}, 'PLAYERS')
assert.equal(r.fields.name, 'Sara Test')
assert.equal(r.fields.position, 'DEFENDER')
assert.equal(r.fields.birthdate, '02/11/2004')
assert.equal(r.fields.languages, 'ARABIC, FRENCH')
assert.equal(r.fields.dualNationality, true)
assert.equal(r.fields.assists, undefined)       // negative rejected
assert.equal(r.fields.cleansheets, undefined)   // null -> not set
assert.equal(r.fields.jerseyNumber, '7')
assert.equal(r.fields.isAdmin, undefined)       // unknown keys never pass through
assert.deepEqual(r.history, [{ year: '2019-2021', event: 'Club A' }, { year: '2021-', event: 'Club B' }])

const empty = sanitizeCv(null, 'PLAYERS')
assert.deepEqual(empty, { fields: {}, history: [] })
const coach = sanitizeCv({ name: 'Coach X', position: 'Head Coach', heightCm: 180, goals: 5 }, 'COACHES')
assert.equal(coach.fields.position, 'HEAD COACH'); assert.equal(coach.fields.height, undefined); assert.equal(coach.fields.goals, undefined)
console.log('cv-extract tests passed')

// ── merging into the form ────────────────────────────────────────────
import { mergeCvIntoForm } from '../lib/cv-extract.ts'
const cv = { fields: { name: 'Sara CV', club: 'Club CV', height: '170', secondNationality: 'French', dualNationality: true, cleansheets: 4 },
  history: [{ year: '2019-2021', event: 'Club A' }, { year: '2021-', event: 'Club B' }] }
const base = { name: 'Typed Name', club: '', height: '', cleansheets: 0, dualNationality: false, secondNationality: '', history: [{ year: '2019-2021', event: 'club a' }, { year: '', event: '' }] }
const m = mergeCvIntoForm(base, cv)
assert.equal(m.form.name, 'Typed Name')                       // typed value kept
assert.deepEqual(m.kept, ['name'])
assert.equal(m.form.club, 'Club CV')                          // empty -> filled
assert.equal(m.form.dualNationality, true)
assert.equal(m.form.cleansheets, 4)                           // 0 counts as empty
assert.deepEqual(m.form.history.map(h => h.event), ['club a', 'Club B'])   // duplicate skipped, blank row dropped
assert.equal(m.historyAdded, 1)
assert.equal(base.name, 'Typed Name')                         // input not mutated
const r2 = mergeCvIntoForm(base, cv, true)
assert.equal(r2.form.name, 'Sara CV')
assert.deepEqual(r2.form.history.map(h => h.event), ['Club A', 'Club B'])
const none = mergeCvIntoForm(base, { fields: {}, history: [] })
assert.deepEqual([none.filled.length, none.kept.length, none.historyAdded], [0, 0, 0])
console.log('cv merge tests passed')
