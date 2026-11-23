import assert from 'node:assert/strict'
import { parsePlayerList } from '../lib/player-list.ts'

// Shape of the real roster PDF: page 1 is a numbered player table, pages 2-3
// are a camp programme and a methodology write-up. Only the table is players.
const doc = [
  { text: 'Liste des joueuses E.N. F u20 à convoquer pendant le', page: 1 },
  { text: 'stage du', page: 1 },
  { text: 'N" Nom et Prénom Club', page: 1 },
  { text: '1 Kmar makhlouf BH', page: 1 },
  { text: '2 yasmin Ayachi BH', page: 1 },
  { text: '7 Roua ben mabrouk UST', page: 1 },
  { text: '10. Rabhi ranim sebitla', page: 1 },
  { text: '15. Ranim ajroud OGC Nice', page: 1 },
  { text: 'U19F', page: 1 }, // wrapped cell annotation, not a player
  { text: '24.', page: 1 },
  { text: 'Selectionneur natinal', page: 1 },
  { text: 'Programme du stage U20 féminine', page: 2 },
  { text: 'Matin : Rassemblement', page: 2 },
  { text: 'Les séances suivent une progression, les situations proches du match, l’observation avec des critères', page: 3 },
  { text: 'J CHOIX DU SYSTÈME DE JEU', page: 3 },
  { text: 'les complémentarités et les ressources disponibles', page: 3 },
]

const rows = parsePlayerList(doc, ['BH', 'UST', 'OGC Nice'])
assert.deepEqual(rows, [
  { name: 'Kmar makhlouf', team: 'BH' },
  { name: 'yasmin Ayachi', team: 'BH' },
  { name: 'Roua ben mabrouk', team: 'UST' },
  { name: 'Rabhi ranim sebitla' },
  { name: 'Ranim ajroud', team: 'OGC Nice' },
])

// No table header: a plain one-name-per-line list still works, but prose is
// rejected (function words, ALL CAPS headings, long sentences).
const plain = parsePlayerList([
  { text: 'Sara Ben Ali', page: 1 },
  { text: 'Aïcha Trabelsi', page: 1 },
  { text: 'PROJET DE STAGE', page: 2 },
  { text: 'situations proches du match', page: 2 },
  { text: 'que des réunions régulières entre les membres du staff', page: 2 },
], [])
assert.deepEqual(plain, [{ name: 'Sara Ben Ali' }, { name: 'Aïcha Trabelsi' }])

// Piped table and a club abbreviation that is not in the hint list.
const piped = parsePlayerList([
  { text: 'Nom | Club', page: 1 },
  { text: 'Lina Khelifi | Stade Tunisien', page: 1 },
  { text: 'Nour Dridi | UST', page: 1 },
], [])
assert.deepEqual(piped, [
  { name: 'Lina Khelifi', team: 'Stade Tunisien' },
  { name: 'Nour Dridi', team: 'UST' },
])

// Text PDFs carry x-coordinates: split on the real column boundary, with no
// help from the club list (new players bring clubs the platform has never seen).
const geometric = parsePlayerList([
  { text: 'N" Nom et Prénom Club', page: 1, items: [{ str: 'Nom', x: 198 }, { str: 'Club', x: 389 }] },
  { text: '9 Zayneb boukhriss Jawhra sfax', page: 1, items: [{ str: '9', x: 149 }, { str: 'Zayneb', x: 198 }, { str: 'boukhriss', x: 243 }, { str: 'Jawhra sfax', x: 368 }] },
  { text: '13 Wided mejri BO U HAJ LA', page: 1, items: [{ str: '13', x: 145 }, { str: 'Wided', x: 212 }, { str: 'mejri', x: 253 }, { str: 'BO U HAJ LA', x: 370 }] },
], [])
assert.deepEqual(geometric, [
  { name: 'Zayneb boukhriss', team: 'Jawhra sfax' },
  { name: 'Wided mejri', team: 'BO U HAJ LA' },
])

console.log('Player list parser tests passed.')
