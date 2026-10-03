// Mesure les couleurs REELLEMENT rendues en clair et en sombre.
// Les probes precedents forçaient toujours le sombre via localStorage ; si le
// navigateur de l'utilisateur est en clair, les regles d'inversion sont
// desactivees et les classes bg-white/zinc重新 apparaissent.
//   $env:OD_USER='...' ; $env:OD_PASS='...' ; node scripts/od-theme.mjs
import { spawn } from 'node:child_process'

const CHROME = process.env.BROWSER_BIN || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
const PORT = Number(process.env.PORT || 3000)
const CDP_PORT = 9349
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--window-size=1440,1100', '--disable-gpu',
  '--user-data-dir=C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\odbrave6',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
      const p = j.find((t) => t.type === 'page')
      if (p?.webSocketDebuggerUrl) return p
    } catch {}
    await sleep(250)
  }
  throw new Error('CDP injoignable')
}

const page = await target()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
const pageErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
}
const send = (m, p = {}) => new Promise((res) => {
  const mid = ++id
  pending.set(mid, (x) => res(x.result))
  ws.send(JSON.stringify({ id: mid, method: m, params: p }))
})
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 250) }
  return r.result?.value
}

await send('Runtime.enable')
await send('Page.enable')
await send('Page.navigate', { url: `http://localhost:${PORT}` })
// Attendre la fin du chargement de la base : saisir trop tot se fait
// effacer par le re-rendu, et le main.ftf-portal n'existe pas encore.
for (let i = 0; i < 40; i++) {
  await sleep(1000)
  const ready = await ev(`!document.body.innerText.includes('LOADING DATABASE') && !!document.querySelector("input[placeholder='Username']")`)
  if (ready === true) break
}
const setNative = `(s,v)=>{const el=document.querySelector(s);if(!el)return false;const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));return el.value}`
await ev(`(${setNative})("input[placeholder='Username']",${JSON.stringify(process.env.OD_USER || '')})`)
await ev(`(${setNative})("input[placeholder='ACCESS KEY']",${JSON.stringify(process.env.OD_PASS || '')})`)
await sleep(400)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/authorize/i.test(x.textContent||''));if(b)b.click()})()`)
for (let i = 0; i < 120; i++) {
  if (await ev(`[...document.querySelectorAll('button')].some(x=>/SENIORS/i.test((x.textContent||'').trim()))`)) break
  await sleep(150)
}
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/SENIORS/i.test((x.textContent||'').trim()));if(b)b.click()})()`)
await sleep(5000)

// Echantillonne le rendu reel : fond du main, des cartes, couleur du texte.
const SAMPLE = `(()=>{
  const px=(el)=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,fg:c.color}};
  const main=document.querySelector('main.ftf-portal');
  const out={ theme:document.documentElement.getAttribute('data-theme'), body:px(document.body) };
  if(main){ out.main=px(main); out.mainClass=main.className.slice(0,90); }
  // Les 6 cartes de premier niveau du main
  const cards=[...main.querySelectorAll(':scope > div, :scope > section, section > div')].slice(0,8);
  out.cards=cards.map(c=>({tag:c.tagName,cls:(c.className||'').toString().slice(0,52),...px(c)}));
  // Une carte qui porte explicitement bg-white : verifie si l'inversion agit.
  const white=document.querySelector('main.ftf-portal .bg-white');
  out.firstBgWhite = white? {cls:(white.className||'').toString().slice(0,60),...px(white)} : null;
  return out;
})()`

const R = {}
for (const theme of ['dark', 'light']) {
  await ev(`(()=>{localStorage.setItem('ftf-theme',${JSON.stringify(theme)});document.documentElement.setAttribute('data-theme',${JSON.stringify(theme)})})()`)
  await sleep(1200)
  R[theme] = await ev(SAMPLE)
}

// La valeur stockee par defaut quand l'utilisateur n'a jamais choisi.
R.defaultStored = await ev(`(()=>{try{return localStorage.getItem('ftf-theme')}catch(e){return 'ERR:'+e.message}})()`)
R.pageErrors = pageErrors
console.log(JSON.stringify(R, null, 2))
ws.close()
chrome.kill()
process.exit(0)
