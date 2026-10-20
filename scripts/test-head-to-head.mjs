import assert from 'node:assert/strict'
import { headToHead, normOpponent } from '../lib/head-to-head.ts'
assert.equal(normOpponent('Algérie'), 'algeria')
assert.equal(normOpponent('ALGERIA Women'), 'algeria')
assert.equal(normOpponent("Côte d'Ivoire"), 'ivory coast')
const ms = [
  { id: 1, opponent: 'Algeria', date: '2023-04-01', result: '2-0', competition: 'Friendly', teamCategory: 'SENIORS', scorers: [{ playerId: 7, goals: 2 }] },
  { id: 2, opponent: 'Algérie', date: '2024-09-10', result: '1-1', competition: 'AFCON qualifier', teamCategory: 'SENIORS', scorers: [{ playerId: 8, goals: 1 }] },
  { id: 3, opponent: 'algeria', date: '2025-02-20', result: '0-3', teamCategory: 'SENIORS' },
  { id: 4, opponent: 'Algeria', date: '2025-07-01', result: '4-1', teamCategory: 'U20', scorers: [{ playerId: 9, goals: 4 }] },
  { id: 5, opponent: 'Algeria', date: '2026-01-01', result: '', teamCategory: 'SENIORS' },
  { id: 6, opponent: 'Morocco', date: '2025-01-01', result: '5-0', teamCategory: 'SENIORS' },
]
const names = { 7: 'Amira', 8: 'Nour', 9: 'Rim' }
const h = headToHead(ms, 'Algeria', { category: 'SENIORS', names })
assert.deepEqual([h.played, h.w, h.d, h.l, h.gf, h.ga, h.cleanSheets, h.winRate], [3, 1, 1, 1, 3, 4, 1, 33])
assert.deepEqual(h.last.map(x => x.id), ['3', '2', '1'])              // newest first
assert.equal(h.biggestWin.id, '1'); assert.equal(h.heaviestLoss.id, '3')
assert.deepEqual(h.scorers.map(s => [s.name, s.goals]), [['Amira', 2], ['Nour', 1]])
assert.deepEqual(h.streak, { type: 'L', n: 1 })
assert.equal(headToHead(ms, 'Algeria', { category: 'U20', names }).played, 1)
assert.equal(headToHead(ms, 'Algeria', { category: 'SENIORS', excludeId: 3 }).played, 2)   // the match being viewed is not its own history
assert.equal(headToHead(ms, 'Egypt').played, 0)
assert.equal(headToHead(ms, '').played, 0)
console.log('head-to-head tests passed')
