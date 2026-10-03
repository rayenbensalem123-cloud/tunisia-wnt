// Inspecte comment chaque origine livre sa CSS, pour comparer Vercel et
// localhost sur le meme footing.
const run = async () => {
  for (const base of ['https://tunisia-wnt.vercel.app', 'http://localhost:3000']) {
    let h = ''
    try {
      const r = await fetch(base)
      h = await r.text()
    } catch (e) {
      console.log('=== ' + base + ' === ERREUR ' + e.message)
      continue
    }
    const cssRefs = [...new Set([...h.matchAll(/[^"'\s<>]*\.css[^"'\s<>]*/g)].map((m) => m[0]))]
    console.log('=== ' + base + ' (' + h.length + ' o) ===')
    console.log('  refs .css  : ' + cssRefs.length + '  ' + JSON.stringify(cssRefs.slice(0, 6)))
    console.log('  balise style: ' + (h.match(/<style/g) || []).length)
    console.log('  balise link : ' + (h.match(/<link/g) || []).length)
    console.log('  head        : ' + h.slice(0, 500).replace(/\s+/g, ' '))
    console.log('')
  }
}
run()
