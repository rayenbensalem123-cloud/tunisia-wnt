// Pilotage Brave/Chrome via CDP brut (WebSocket natif Node 22). Aucune dependance ajoutee.
// Identifiants via l'environnement, jamais dans le fichier :
//   $env:OD_USER='...' ; $env:OD_PASS='...' ; node scripts/od-cdp.mjs
// Variables optionnelles : VW, VH, THEME (dark|light), LABEL, BROWSER_BIN.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const CHROME = process.env.BROWSER_BIN || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
const PORT = Number(process.env.PORT || 3111)
const CDP_PORT = 9333
const OUT = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\odshots'
mkdirSync(OUT, { recursive: true })

const width = Number(process.env.VW || 1440)
const height = Number(process.env.VH || 900)
const label = process.env.LABEL || 'desktop'
const theme = process.env.THEME || 'dark'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  `--window-size=${width},${height}`, '--disable-gpu',
  '--user-data-dir=C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\odbrave',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })

async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
      const j = await r.json()
      const page = j.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome CDP injoignable')
}

const page = await targets()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let id = 0
const pending = new Map()
const consoleErrors = []
const pageErrors = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  }
  if (m.method === 'Runtime.exceptionThrown') {
    pageErrors.push((m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 250))
  }
}
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id
  pending.set(mid, (m) => res(m.result))
  ws.send(JSON.stringify({ id: mid, method, params }))
})

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 300) }
  return r.result?.value
}

await send('Runtime.enable')
await send('Page.enable')
await send('Network.enable')

// Capturer le payload de la table 'members' avant que l'app ne le consomme.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__odRoster = null;
    const _fetch = window.fetch;
    window.fetch = async function (...a) {
      const r = await _fetch.apply(this, a);
      try {
        const u = String(typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || '');
        if (/rest\\/v1\\/members/.test(u)) {
          const c = r.clone();
          c.json().then(j => { if (Array.isArray(j) && j.length) window.__odRoster = j; }).catch(()=>{});
        }
      } catch(e) {}
      return r;
    };
  `,
})

// Injecter le theme et la langue avant tout chargement
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.setItem('ftf-theme','${theme}');localStorage.setItem('esq-lang','${process.env.LANG_CODE || 'en'}')}catch(e){}`,
})

await send('Page.navigate', { url: `http://localhost:${PORT}` })
// Attendre que le chargement de la base soit fini (ecran "LOADING DATABASE...").
for (let i = 0; i < 40; i++) {
  await sleep(1000)
  const ready = await evaluate(`!document.body.innerText.includes('LOADING DATABASE') && !!document.querySelector("input[placeholder='Username'], .ftf-portal")`)
  if (ready === true) { break }
}

const setNative = `(sel,val)=>{const el=document.querySelector(sel);if(!el)return false;const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));return el.value}`
await evaluate(`(${setNative})("input[placeholder='Username']",${JSON.stringify(process.env.OD_USER || '')})`)
await evaluate(`(${setNative})("input[placeholder='ACCESS KEY']",${JSON.stringify(process.env.OD_PASS || '')})`)
await sleep(400)
const filled = await evaluate(`JSON.stringify({u:document.querySelector("input[placeholder='Username']")?.value,k:document.querySelector("input[placeholder='ACCESS KEY']")?.value})`)
await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/authorize/i.test(x.textContent||''));if(b){b.click();return true}return false})()`)

for (let i = 0; i < 120; i++) {
  const found = await evaluate(`[...document.querySelectorAll('button')].some(x=>/SENIORS/i.test((x.textContent||'').trim()))`)
  if (found) break
  await sleep(150)
}
await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/SENIORS/i.test((x.textContent||'').trim()));if(b){b.click();return true}return false})()`)
await sleep(5000)

// Onglet Stats
const statsFound = await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(Stats|Statistiques|إحصائيات)$/i.test((x.textContent||'').trim()));if(b){b.click();return (b.textContent||'').trim()}return null})()`)
await sleep(2500)

const statsProbe = await evaluate(`(()=>{
  const txt=[...document.querySelectorAll('.ftf-portal *')].filter(el=>el.children.length===0&&(el.textContent||'').trim()).map(el=>(el.textContent||'').trim())
  const titles=/^(Top Scorers|Most Assists|Most Caps|Meilleures buteuses|Meilleures passeuses|Plus de sélections|الأهداف|الصناعة|الاستدعاءات)$/
  const cols=txt.filter(t=>titles.test(t))
  const recent=/^(Recent Form|Forme récente|آخر النتائج)$/.test(txt.find(t=>/Forme|recent|آخر/i.test(t))||'')
  const rankRows=txt.filter(t=>/^\\d{1,2}$/.test(t)).length
  const emDashes=txt.filter(t=>t==='—').length
  const badges=txt.filter(t=>/^(GK|DEF|MID|FWD|GAR|MIL|ATT|حرس|دفاع|وسط|هجوم)$/.test(t)).length
  const root=document.querySelector('[data-od-id=\"stats\"]')
  const bigNums=root?[...root.querySelectorAll('.tabular-nums')].map(e=>e.textContent.trim()).filter(t=>/^\\d{1,4}$/.test(t)&&parseInt(t)>3):[]
  const podCards=root?[...root.children].filter(c=>c.querySelector('.tabular-nums')):[]  
  const firstCard=root&&root.firstElementChild?root.firstElementChild.innerText.replace(/\\n+/g,' | ').slice(0,200):null
  const discCard=root&&root.children[1]?root.children[1].innerText.replace(/\\n+/g,' | ').slice(0,260):null
  const dump=(()=>{try{
  // Les donnees viennent de Supabase (table 'members'). Interception du reseau
  // pour inspecter les vraies valeurs : c'est la seule source de verite.
  const w=window.__odRoster
  if(!w)return{err:'requete members non interceptee'}
  const pl=w.filter(p=>p.role==='PLAYERS')
  const f=(k)=>{const v=pl.map(p=>p[k]);return{defined:v.filter(x=>x!==undefined&&x!==null).length,gt0:v.filter(x=>Number(x)>0).length,sample:v.slice(0,8)}}
  return { total:w.length, players:pl.length, goals:f('goals'), assists:f('assists'), natMatches:f('nat_matches'), natMatchesCamel:f('natMatches'), yellow:f('yellow_cards'), positions:f('position') }
}catch(e){return{err:String(e)}}})()
return { columnTitles: cols, recentFormPresent: recent, rankNumbers: rankRows, emDashRows: emDashes, posBadges: badges, noRecordsShown: txt.some(t=>/no records|aucun/i.test(t)), podiumCards: podCards.length, bigNums, firstCard, discCard, dump }
})()`)

const audit = await evaluate(`(()=>{
  const de=document.documentElement, sizes={}, tiny=[]
  document.querySelectorAll('.ftf-portal *').forEach(el=>{
    const t=Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim())
    if(!t) return
    const fs=Math.round(parseFloat(getComputedStyle(el).fontSize))
    sizes[fs]=(sizes[fs]||0)+1
    if(fs<10) tiny.push({fs,txt:(el.textContent||'').trim().slice(0,25)})
  })
  const ov=Array.from(document.querySelectorAll('.ftf-portal *')).map(el=>{const r=el.getBoundingClientRect();return{r:Math.round(r.right),w:Math.round(r.width),l:Math.round(r.left),y:Math.round(r.top),txt:(el.textContent||'').trim().slice(0,22)}}).filter(o=>o.r>window.innerWidth+2&&o.w>3&&o.w<window.innerWidth&&o.l>-100)
  const h=Object.keys(sizes)
  return {
    where: document.querySelector('.ftf-portal') ? 'PORTAL' : 'HORS PORTAL',
    bodyText: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,160),
    filled: ${JSON.stringify(filled)},
    statsTabLabel: ${JSON.stringify(statsFound)},
    portalNodes: document.querySelectorAll('.ftf-portal *').length,
    minFontSize: h.length ? Math.min(...h.map(Number)) : null,
    histogram: sizes,
    tinyText: tiny.slice(0,8),
    overflowCount: ov.length,
    overflow: ov.slice(0,8),
    scrollW: de.scrollWidth, clientW: de.clientWidth,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    dataTheme: document.documentElement.getAttribute('data-theme'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }
})()`)

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync(`${OUT}\\${label}.png`, Buffer.from(shot.data, 'base64'))

console.log(JSON.stringify({ audit, statsProbe, consoleErrors, pageErrors }, null, 2))
ws.close()
chrome.kill()
process.exit(0)