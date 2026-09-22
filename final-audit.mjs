import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome', headless: true })
const viewports = [
  { name: 'laptop', vw: 1366, h: 900, isMobile: false },
  { name: 'ipad-pro', vw: 1024, h: 1366, isMobile: false },
  { name: 'ipad', vw: 768, h: 1024, isMobile: true },
  { name: 'pixel7', vw: 412, h: 915, isMobile: true },
  { name: 'iphone12', vw: 390, h: 844, isMobile: true },
  { name: 'android', vw: 360, h: 740, isMobile: true }
]
const shots = 'C:/Users/user/AppData/Local/Temp/opencode/shots3'
const out = []
for (const v of viewports) {
  const ctx = await b.newContext({ viewport: { width: v.vw, height: v.h }, isMobile: v.isMobile })
  const p = await ctx.newPage()
  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.fill('input[placeholder="Username"]', 'admin')
  await p.fill('input[placeholder="ACCESS KEY"]', 'admin@2026')
  await p.click('button:has-text("Authorize")')
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => Array.from(document.querySelectorAll('button')).some(x => x.textContent && x.textContent.trim().toUpperCase().indexOf('SENIORS') >= 0))) break
    await p.waitForTimeout(100)
  }
  await p.locator('button:has-text("SENIORS")').first().click()
  await p.waitForTimeout(4500)
  const r = await p.evaluate((shot) => {
    const de = document.documentElement
    const row1 = Array.from(document.querySelectorAll('header > div'))[1]
    const rr = row1?.getBoundingClientRect()
    const rowEl = Array.from(document.querySelectorAll('header > div > div')).find(d => String(d.className).includes('gap-1'))
    const cr = rowEl?.getBoundingClientRect()
    const overflow = Array.from(document.querySelectorAll('.ftf-portal *')).map(el => el.getBoundingClientRect()).filter(r2 => r2.right > window.innerWidth + 2 && r2.width > 3 && r2.width < window.innerWidth && r2.left > -100).map(r2 => ({ r: Math.round(r2.right), w: Math.round(r2.width), x: Math.round(r2.left) })).slice(0, 6)
    return { name: shot, vw: window.innerWidth, clientWidth: de.clientWidth, scrollW: de.scrollWidth, headerH: row1 ? Math.round(row1OffsetTop) + Math.round(rr.height) : -1, row1H: rr ? Math.round(rr.height) : -1, row1L: rr ? Math.round(rr.left) : -1, row1R: rr ? Math.round(rr.right) : -1, cluster: cr ? { l: Math.round(cr.left), r: Math.round(cr.right), w: Math.round(cr.width), h: Math.round(cr.height) } : null, overflow }
  }, v.name)
  out.push(r)
  await ctx.close()
}
console.log(out.map(o => JSON.stringify(o)).join('\n'))
await b.close()
console.log('AUDIT-DONE')