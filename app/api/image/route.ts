import { NextResponse } from 'next/server'

// Legacy Blob support is restricted to the official Blob hosts.
// Any other host would turn this route into an open proxy and would leak
// BLOB_READ_WRITE_TOKEN to a third party.
const BLOB_HOSTS = ['blob.vercel-storage.com', '.public.blob.vercel-storage.com']
const BLOB_PATH_RE = /^\/store\/[\w-]+\/[^/]+/

function isAllowedBlobUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  if (!BLOB_HOSTS.some((h) => (h.startsWith('.') ? u.hostname.endsWith(h) : u.hostname === h))) return false
  return BLOB_PATH_RE.test(u.pathname)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  if (path.startsWith('http') || path.startsWith('//')) {
    if (!isAllowedBlobUrl(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    try {
      const res = await fetch(path, { headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } })
      if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const buffer = Buffer.from(await res.arrayBuffer())
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': res.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // Reject traversal in the object key.
  if (path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: 'Bad path' }, { status: 400 })
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  return NextResponse.redirect(`${base}/storage/v1/object/public/members/${path}`)
}
