// Compare le CSS reellement servi par Vercel et par localhost.
// Le design visuel vit presque entierement dans globals.css : si les deux
// origines servent des CSS differents, c'est la que se trouve l'ecart.
//   node scripts/od-cssdiff.mjs
const grab = async (base) => {
  const html = await (await fetch(base)).text()
  // L'ordre des attributs du <link> n'est pas garanti : on cherche le chemin
  // plutot qu'un motif href="..." exact.
  const links = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_\-.%[\]]+\.css/g)].map((m) => m[0]))]
  let all = ''
  for (const l of links) {
    const css = await (await fetch(base + l)).text()
    all += css
  }
  return { links, css: all }
}

const v = await grab('https://tunisia-wnt.vercel.app')
const l = await grab('http://localhost:3000')

console.log('vercel    : fichiers css=' + v.links.length + '  octets=' + v.css.length)
console.log('localhost : fichiers css=' + l.links.length + '  octets=' + l.css.length)

const keys = [
  '--c-', '.ftf-portal', 'data-theme="light"', 'data-theme=\\"light\\"',
  'linear-gradient', 'Oswald', '#0b111e', '#0c1f3d', '#e3062c',
  'radial-gradient', 'backdrop-filter', '@font-face', 'tailwind',
]
console.log('')
console.log('token'.padEnd(24) + 'vercel'.padEnd(9) + 'localhost')
for (const k of keys) {
  const a = v.css.split(k).length - 1
  const b = l.css.split(k).length - 1
  console.log(k.padEnd(24) + String(a).padEnd(9) + b + (a === b ? '' : '   <-- DIFFERE'))
}

// Les jetons --c-* sont le coeur du design : on les compare un par un.
const tokenNames = (s) => [...new Set([...s.matchAll(/(--c-[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]))].sort()
const tv = tokenNames(v.css)
const tl = tokenNames(l.css)
console.log('')
console.log('jetons --c-* : vercel=' + tv.length + '  localhost=' + tl.length)
const onlyV = tv.filter((x) => !tl.includes(x))
const onlyL = tl.filter((x) => !tv.includes(x))
if (onlyV.length) console.log('presents UNIQUEMENT sur vercel : ' + onlyV.join(', '))
if (onlyL.length) console.log('presents UNIQUEMENT sur localhost : ' + onlyL.join(', '))
if (!onlyV.length && !onlyL.length) console.log('jeux de jetons identiques')

// Les valeurs different-elles pour un meme jeton ?
const valOf = (s, name) => {
  const m = s.match(new RegExp(name + '\\s*:\\s*([^;}]+)'))
  return m ? m[1].trim() : null
}
const diffs = []
for (const n of tv.filter((x) => tl.includes(x))) {
  const a = valOf(v.css, n)
  const b = valOf(l.css, n)
  if (a && b && a !== b) diffs.push({ n, a, b })
}
console.log('')
console.log('jetons dont la VALEUR differe : ' + diffs.length)
for (const d of diffs.slice(0, 40)) console.log('  ' + d.n.padEnd(18) + 'vercel=' + d.a.slice(0, 40) + '  local=' + d.b.slice(0, 40))
