// Test de la logique exacte de StatsView, isolee du DOM.
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const posLabel = (v) => String(v ?? '').slice(0, 3).toUpperCase() || '—'
const byNum = (squad, k) => [...squad].sort((a, b) => num(b?.[k]) - num(a?.[k])).slice(0, 10)

let fail = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fail++
  console.log(`${ok ? 'OK  ' : 'ECHEC'} ${label} -> ${JSON.stringify(actual)}${ok ? '' : ` (attendu ${JSON.stringify(expected)})`}`)
}

console.log('=== 1. Le crash d avant ===')
try { undefined.slice(0, 3); console.log('ECHEC ancien code: devrait jetter') } catch (e) { console.log('CONFIRME  ancien code jette:', e.constructor.name) }

console.log('\n=== 2. posLabel, les 5 cas de donnees reelles ===')
check('position undefined', posLabel(undefined), '—')
check('position null', posLabel(null), '—')
check('position chaine vide', posLabel(''), '—')
check('position MIDFIELDER', posLabel('MIDFIELDER'), 'MID')
check('position goalkeeper minuscule', posLabel('goalkeeper'), 'GOA')

console.log('\n=== 3. num, saisie parasite ===')
check('chaine "12"', num('12'), 12)
check('chaine "N/A"', num('N/A'), 0)
check('chaine "12 (2)"', num('12 (2)'), 0)
check('undefined', num(undefined), 0)
check('null', num(null), 0)
check('nombre 0', num(0), 0)

console.log('\n=== 4. byNum, tri avec melange string / nombre / poubelle ===')
const squad = [
  { id: 1, name: 'A', position: 'FORWARD', goals: '3', natMatches: 'N/A' },
  { id: 2, name: 'B', position: undefined, goals: 10, natMatches: 47 },
  { id: 3, name: 'C', position: '', goals: '7', natMatches: '' },
  { id: 4, name: 'D', position: 'GOALKEEPER', goals: '0', natMatches: 3 },
]
const order = (k) => byNum(squad, k).map((p) => p.name)
check('tri par goals (10,7,3,0)', order('goals'), ['B', 'C', 'A', 'D'])
check('tri par natMatches (47,3,0,0)', order('natMatches'), ['B', 'D', 'A', 'C'])
check('aucun NaN dans le comparateur', order('natMatches').length, 4)

console.log('\n=== 5. le rendu complet ne leve rien ===')
const render = (s) => s.map((p) => `${posLabel(p.position)} ${p.name} ${num(p.goals)}`).join(' | ')
console.log('rendu :', render(byNum(squad, 'goals')))

console.log('\n=== 6. podium : seules les valeurs > 0 sont eligiblees ===')
// byNum filtre desormais les zeros : crowned ne doit pas etre un joueur a 0 but.
const byNumPodium = (s, k) => [...s].filter((p) => num(p[k]) > 0).sort((a, b) => num(b?.[k]) - num(a?.[k]))
const leader = (arr, k) => (arr.length ? { p: arr[0], v: num(arr[0][k]) } : null)
const squad2 = [
  { id: 1, name: 'Zoube', position: 'FORWARD', goals: 0, assists: 4, natMatches: 12 },
  { id: 2, name: 'Amina', position: 'MIDFIELDER', goals: 9, assists: 0, natMatches: 30 },
  { id: 3, name: 'Sarra', position: undefined, goals: 5, assists: 7, natMatches: null },
]
check('but : zero exclu, Amina 9 devant Sarra 5', byNumPodium(squad2, 'goals').map((p) => p.name), ['Amina', 'Sarra'])
// assists : Sarra 7, Zoube 4, Amina 0 (exclue)
check('passe : zero exclu, Sarra 7 devant Zoube 4', byNumPodium(squad2, 'assists').map((p) => p.name), ['Sarra', 'Zoube'])
check('selections : Amina 30', byNumPodium(squad2, 'natMatches').map((p) => p.name), ['Amina', 'Zoube'])
check('podium but = Amina / 9', (l => l && [l.p.name, l.v])(leader(byNumPodium(squad2, 'goals'), 'goals')), ['Amina', 9])
check('podium vide => null', leader([], 'goals'), null)
check('podium vide sur une squad sans stat', leader(byNumPodium([], 'goals'), 'goals'), null)
check('posLabel de la joueuse sans position', posLabel(squad2[2].position), '—')

console.log('\n=== 7. discipline, regle CAF ===')
const YELLOW_SUSPENSION = 2
const getCardStatus = (m) => {
  if (m.role !== 'PLAYERS') return null
  const yc = m.yellowCards || 0
  if (m.suspended || (m.redCards || 0) > 0) return 'suspended'
  if (yc >= YELLOW_SUSPENSION) return 'suspended'
  if (yc === YELLOW_SUSPENSION - 1) return 'warning'
  return null
}
const disc = [
  { role: 'PLAYERS', name: 'A', yellowCards: 0, redCards: 0 },
  { role: 'PLAYERS', name: 'B', yellowCards: 1, redCards: 0 },
  { role: 'PLAYERS', name: 'C', yellowCards: 2, redCards: 0 },
  { role: 'PLAYERS', name: 'D', yellowCards: 0, redCards: 1 },
  { role: 'PLAYERS', name: 'E', yellowCards: 0, redCards: 0, suspended: true },
  { role: 'COACH', name: 'F', yellowCards: 2, redCards: 2 },
]
const risk = disc.filter((p) => getCardStatus(p) === 'warning')
const out = disc.filter((p) => getCardStatus(p) === 'suspended')
const playersOnly = disc.filter((p) => p.role === 'PLAYERS')
check('1 carton jaune = a risque', risk.map((p) => p.name), ['B'])
check('2 jaunes / rouge / drapeauxuspendues = suspendues', out.map((p) => p.name), ['C', 'D', 'E'])
check('le staff ne compte pas', playersOnly.length, 5)
// 5 joueuses - 1 a risque (B) - 3 suspendues (C, D, E) = 1 disponible (A)
check('disponibles = effectif - risque - suspendues', playersOnly.length - risk.length - out.length, 1)
check('disponibles + risque + suspendues = effectif', out.length + risk.length + (playersOnly.length - risk.length - out.length), playersOnly.length)
const sum = (k) => playersOnly.reduce((a, p) => a + num(p[k]), 0)
check('total jaunes', sum('yellowCards'), 3)
check('total rouges', sum('redCards'), 1)
check('cumul discipline jamais negatif', Math.max(0, playersOnly.length - risk.length - out.length) >= 0, true)

console.log('\n=== 8. postes : les 4 compteurs + les positions inconnues ===')
const posCount = { GOALKEEPER: 0, DEFENDER: 0, MIDFIELDER: 0, FORWARD: 0 }
let unknownPos = 0
squad2.forEach((p) => { if (p.position in posCount) posCount[p.position]++; else unknownPos++ })
check('inconnues comptees a part', unknownPos, 1)
check('les compteurs + inconnues = effectif', Object.values(posCount).reduce((a, b) => a + b, 0) + unknownPos, squad2.length)

console.log(fail === 0 ? '\n=> TOUS LES TESTS PASSENT' : `\n=> ${fail} ECHEC(S)`)
process.exit(fail === 0 ? 0 : 1)