// Reproduit le cas exact de l'utilisateur : une ancienne cle ftf-theme
// valant "light" est deja dans le navigateur. On verifie que l'app demarre
// maintenant sur le theme sombre, qui est celui du design.
//   $env:OD_USER='...' ; $env:OD_PASS='...' ; node scripts/od-themefix.mjs
import { spawn } from 'node:child_process'

const CHROME = process.env.BROWSER_BIN || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
const PORT = Number(process.env.PORT || 3000)
const CDP_PORT = 9350
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--window-size=1440,1100', '--disable-gpu',
  '--user-data-dir=C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\odbrave7',
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
// Le cas de l'utilisateur : ancienne cle a "light", nouvelle cle absente.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.setItem('ftf-theme','light')}catch(e){}`,
})
await send('Page.navigate', { url: `http://localhost:${PORT}` })
for (let i = 0; i < 40; i++) {
  await sleep(1000)
  if (await ev(`!document.body.innerText.includes('LOADING DATABASE') && !!document.querySelector("input[placeholder='Username']")`) === true) break
}

const R = {}
// Etat avant connexion : c'est ce que voit l'utilisateur en ouvrant l'app.
R.beforeLogin = await ev(`({ theme: document.documentElement.getAttribute('data-theme'), bodyBg: getComputedStyle(document.body).backgroundColor })`)

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

R.afterLogin = await ev(`(()=>{
  const main=document.querySelector('main.ftf-portal');
  const w=main&&main.querySelector('.bg-white');
  return{
    theme: document.documentElement.getAttribute('data-theme'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    mainBg: main?getComputedStyle(main).backgroundColor:null,
    whiteCardBg: w?getComputedStyle(w).backgroundColor:null,
  }
})()`)

// Le bouton de bascule doit exister ET indiquer la destination.
R.toggle = await ev(`(()=>{
  const b=[...document.querySelectorAll('button')].find(x=>/Switch to (light|dark) mode/i.test(x.title||''));
  if(!b)return{present:false}
  const r=b.getBoundingClientRect();
  return{present:true,title:b.title,visible:r.width>0&&r.height>0,w:Math.round(r.width),h:Math.round(r.height),count:document.querySelectorAll('button[title^="Switch to"]').length}
})()`)

// Un clic doit basculer vers light, et persister sous la nouvelle cle.
if (R.toggle && R.toggle.present) {
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Switch to (light|dark) mode/i.test(x.title||''));if(b)b.click()})()`)
  await sleep(700)
  R.afterToggleClick = await ev(`({ theme: document.documentElement.getAttribute('data-theme'), stored: localStorage.getItem('ftf-theme-v2'), bodyBg: getComputedStyle(document.body).backgroundColor })`)
}

R.staleKeyIgnored = await ev(`localStorage.getItem('ftf-theme')`)
R.pageErrors = pageErrors
console.log(JSON.stringify(R, null, 2))
ws.close()
chrome.kill()
process.exit(0)
