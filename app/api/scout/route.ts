import { NextResponse } from 'next/server'

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const UA = 'TunisiaWNT/1.0'

async function searchWikipedia(name: string) {
  // Direct page access first
  const directTitle = name.trim().replace(/\s+/g, '_')
  const parseUrl = `${WIKI_API}?action=parse&page=${encodeURIComponent(directTitle)}&prop=text&format=json&redirects=1`
  let res = await fetch(parseUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
  let data: any = await res.json()
  let html: string | null = data?.parse?.text?.['*'] || null

  if (!html) {
    // Search instead
    const sq = encodeURIComponent(`"${name.trim()}" footballer`)
    const searchUrl = `${WIKI_API}?action=query&list=search&srsearch=${sq}&format=json&srlimit=5`
    res = await fetch(searchUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
    data = await res.json()
    const pages = data?.query?.search || []
    for (const page of pages) {
      if (page.title.includes('national football team') || page.title.includes('List of')) continue
      const pr = await fetch(`${WIKI_API}?action=parse&page=${encodeURIComponent(page.title)}&prop=text&format=json&redirects=1`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
      const pd: any = await pr.json()
      html = pd?.parse?.text?.['*'] || null
      if (html) break
    }
  }

  if (!html) return null

  const { load } = await import('cheerio')
  const $ = load(html)

  // Check it's a player page
  const hasPos = $('.infobox tr th').filter((_: any, el: any) => {
    const t = $(el).text().trim().toLowerCase()
    return t === 'position' || t === 'position(s)'
  }).length > 0
  if (!hasPos) return null

  // Parse infobox
  const info: Record<string, string> = {}
  $('.infobox tr').each((_: any, tr: any) => {
    const th = $(tr).find('th').first().text().trim().toLowerCase()
    const td = $(tr).find('td').first().text().trim().replace(/\s+/g, ' ')
    if (th && td && !info[th]) info[th] = td
  })

  // Position
  const posRaw = info['position'] || info['position(s)'] || ''
  const posUpper = posRaw.toUpperCase()
  const position = posUpper.includes('GOALKEEPER') ? 'GOALKEEPER'
    : posUpper.includes('DEFENDER') || posUpper.includes('DEFENCE') || posUpper.includes('BACK') ? 'DEFENDER'
    : posUpper.includes('MIDFIELDER') || posUpper.includes('MIDFIELD') ? 'MIDFIELDER'
    : posUpper.includes('FORWARD') || posUpper.includes('STRIKER') || posUpper.includes('WINGER') || posUpper.includes('ATTACK') ? 'FORWARD'
    : ''

  // Birthdate → normalize to dd/mm/yyyy
  const birthRaw = info['date of birth'] || info['born'] || ''
  let birthdate = ''
  // 1. Try full date first: "8 August 1994"
  const dmy = birthRaw.match(/(\d+)\s+(\w+)\s+(\d{4})/)
  if (dmy) {
    const months: Record<string, string> = {january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'}
    const mon = months[dmy[2].toLowerCase()] || '01'
    const day = dmy[1].padStart(2,'0')
    birthdate = `${day}/${mon}/${dmy[3]}`
  }
  // 2. Fallback to ISO bday: "1994-08-08"
  if (!birthdate) {
    const iso = birthRaw.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
      const [, y, m, d] = iso
      birthdate = `${d}/${m}/${y}`
    }
  }
  // 3. Fallback to age-based: "age 31"
  if (!birthdate) {
    const ageMatch = birthRaw.match(/age\s*(\d+)/i)
    if (ageMatch) {
      const by = new Date().getFullYear() - parseInt(ageMatch[1])
      birthdate = `01/01/${by}`
    }
  }
  // 4. Fallback to 4-digit year
  if (!birthdate) {
    const yr = birthRaw.match(/(\d{4})/)
    if (yr) birthdate = `01/01/${yr[1]}`
  }

  // Height
  const heightRaw = info['height'] || ''
  let height = ''
  const cmMatch = heightRaw.match(/(\d+)\s*cm/i)
  if (cmMatch) height = cmMatch[1]
  else { const mMatch = heightRaw.match(/(\d\.\d+)\s*m/i); if (mMatch) height = String(Math.round(parseFloat(mMatch[1]) * 100)) }

  // Club
  let club = ''
  $('.infobox tr').each((_: any, tr: any) => {
    if ($(tr).find('th').text().trim().toLowerCase().includes('current team'))
      club = $(tr).find('td').first().text().trim().replace(/\s+/g, ' ')
  })

  // Caps + goals from international career
  let caps = 0, goals = 0
  $('.infobox tr th').each((_: any, el: any) => {
    if ($(el).text().trim().toLowerCase().includes('international career')) {
      let row = $(el).parent()
      while ((row = row.next()).length) {
        const tds = row.find('td')
        if (tds.length >= 2 && $(tds[0]).text().trim().includes('Tunisia')) {
          caps = parseInt($(tds[1]).text().trim().replace(/[+]/g, '')) || 0
          if (tds.length >= 3) goals = parseInt($(tds[2]).text().trim().replace(/[()+]/g, '')) || 0
        }
      }
    }
  })

  // History (senior career only)
  const history: { year: string; event: string }[] = []
  $('.infobox tr th').each((_: any, el: any) => {
    if ($(el).text().trim().toLowerCase().includes('senior career')) {
      let row = $(el).parent()
      while ((row = row.next()).length) {
        const rth = row.find('th').first().text().trim().toLowerCase()
        if (rth.includes('international career') || rth.includes('youth career') || rth.includes('total')) break
        const yr = row.find('th').first().text().trim()
        const ev = row.find('td').first().text().trim()
        if (yr && ev && !yr.includes('years') && !ev.includes('Team'))
          history.push({ year: yr, event: ev.replace(/\s+/g, ' ') })
      }
    }
  })

  return { name: data?.parse?.title || name, position, birthdate, height, club, caps, goals, history }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    // Get database data
    const { searchPlayerDatabase } = await import('@/lib/player-database')
    const dbResult = searchPlayerDatabase(name)
    const dbData = dbResult.found && dbResult.data ? {
      name: dbResult.data.name,
      club: dbResult.data.club,
      position: dbResult.data.position,
      birthdate: dbResult.data.birthdate,
      height: dbResult.data.height,
      natMatches: dbResult.data.natMatches,
      goals: dbResult.data.goals,
      assists: dbResult.data.assists,
      yellowCards: dbResult.data.yellowCards,
      redCards: dbResult.data.redCards,
      history: dbResult.data.history,
    } : null

    // Try Wikipedia
    let wikiData: any = null
    try {
      const w = await searchWikipedia(name.trim())
      if (w && (w.position || w.club)) {
        wikiData = {
          name: w.name,
          club: w.club || '',
          position: w.position || '',
          birthdate: w.birthdate || '',
          height: w.height || '',
          natMatches: w.caps || 0,
          goals: w.goals || 0,
          assists: 0,
          history: w.history || [],
        }
      }
    } catch {}

    return NextResponse.json({
      sources: {
        database: dbData,
        wikipedia: wikiData,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
