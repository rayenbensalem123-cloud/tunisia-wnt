// Un clic = un tour de boucle React. Lire .value dans la meme tournure
// synchrone renvoie l'ancienne valeur : il faut laisser le rendu passer.
//   $env:OD_USER='...' ; $env:OD_PASS='...' ; node scripts/od-stepper.mjs
import { spawn } from 'node:child_process'

const CHROME = process.env.BROWSER_BIN || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
const PORT = Number(process.env.PORT || 3000)
const CDP_PORT = 9348
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--window-size=1440,1100', '--disable-gpu',
  '--user-data-dir=C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\odbrave5',
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
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('ftf-theme','dark')}catch(e){}` })
await send('Page.navigate', { url: `http://localhost:${PORT}` })
for (let i = 0; i < 40; i++) {
  await sleep(1000)
  if (await ev(`!document.body.innerText.includes('LOADING DATABASE') && !!document.querySelector("input[placeholder='Username'], .ftf-portal")`) === true) break
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
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(PLAYERS|JOUEURS)$/i.test((x.textContent||'').trim()));if(b)b.click()})()`)
await sleep(1500)
await ev(`document.querySelector('button[title="Add new player/staff"]')?.click()`)
await sleep(1500)

const readYellow = `Number(document.querySelectorAll('[data-od-picker="number"]')[0].value)`
const clickPlus = `document.querySelectorAll('[data-od-picker="number"]')[0].parentElement.parentElement.querySelectorAll('button')[1].click()`
const clickMinus = `document.querySelectorAll('[data-od-picker="number"]')[0].parentElement.parentElement.querySelectorAll('button')[0].click()`

const R = { steps: [] }
R.steps.push({ at: 'depart', value: await ev(readYellow) })

// Un clic, une attente, une lecture : un tour de boucle React par pas.
for (let i = 1; i <= 3; i++) {
  await ev(clickPlus)
  await sleep(350)
  R.steps.push({ at: `plus x${i}`, value: await ev(readYellow) })
}
for (let i = 1; i <= 2; i++) {
  await ev(clickMinus)
  await sleep(350)
  R.steps.push({ at: `minus x${i}`, value: await ev(readYellow) })
}

// Branche max=5 du deuxieme stepper (cartons rouges).
const redPlus = `document.querySelectorAll('[data-od-picker="number"]')[1].parentElement.parentElement.querySelectorAll('button')[1].click()`
const readRed = `Number(document.querySelectorAll('[data-od-picker="number"]')[1].value)`
for (let i = 1; i <= 6; i++) {
  await ev(redPlus)
  await sleep(250)
  R.steps.push({ at: `rouge plus x${i}`, value: await ev(readRed) })
}

R.plusDisabledAtMax = await ev(`document.querySelectorAll('[data-od-picker="number"]')[1].parentElement.parentElement.querySelectorAll('button')[1].disabled`)
R.pageErrors = pageErrors
console.log(JSON.stringify(R, null, 2))
ws.close()
chrome.kill()
process.exit(0)