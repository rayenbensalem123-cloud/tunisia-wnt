import { NextResponse } from 'next/server'

const QUERIES = [
  'Tunisia women\'s national football team',
  'CAF WAFCON women\'s football',
  'FIFA women\'s football',
]

function parseRssItems(xml: string, sourceLabel: string) {
  const items: any[] = []
  const itemBlocks = xml.split('<item>').slice(1)
  for (const block of itemBlocks) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
      if (!m) return ''
      return m[1]
        .replace('<![CDATA[', '').replace(']]>', '')
        .replace(/<[^>]+>/g, '')
        .trim()
    }
    const title = get('title')
    const link = get('link')
    const pubDate = get('pubDate')
    const source = get('source') || sourceLabel
    if (title && link) items.push({ title, link, pubDate, source })
  }
  return items
}

export async function GET() {
  try {
    const results = await Promise.all(
      QUERIES.map(async (q) => {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
        try {
          const res = await fetch(url, { next: { revalidate: 1800 } }) // cache 30 min
          if (!res.ok) return []
          const xml = await res.text()
          return parseRssItems(xml, 'Google News')
        } catch {
          return []
        }
      })
    )

    // Merge, dedupe by title, sort by date, cap at 24
    const seen = new Set<string>()
    const merged = results.flat().filter((item) => {
      const key = item.title.toLowerCase().slice(0, 60)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    merged.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

    return NextResponse.json({ items: merged.slice(0, 24) })
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 500 })
  }
}
