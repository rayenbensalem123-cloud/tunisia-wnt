import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Legacy Blob support is restricted to the official Blob hosts.
// Any other host would turn this route into an open proxy and would leak
// BLOB_READ_WRITE_TOKEN to a third party.
const BLOB_HOSTS = ['blob.vercel-storage.com', '.public.blob.vercel-storage.com']
const BLOB_PATH_RE = /^\/store\/[\w-]+\/[^/]+/

// Short-lived in-memory cache so a squad of 20 players doesn't trigger
// 20 signing round-trips on every render.
const CACHE_TTL_MS = 10 * 60 * 1000
const signedCache = new Map<string, { url: string; at: number }>()

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

function safeKey(p: string): boolean {
  return /^[A-Za-z0-9._/-]+$/.test(p) && !p.includes('..') && !p.startsWith('/')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  // ── Legacy Vercel Blob objects (allowlisted hosts only) ──
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

  // ── Supabase storage objects: the bucket is private, so sign a short-lived URL ──
  if (!safeKey(path)) return NextResponse.json({ error: 'Bad path' }, { status: 400 })

  const hit = signedCache.get(path)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.redirect(hit.url)
  }

  const EXPIRES = 60 * 60 // 1 hour
  const { data, error } = await supabaseAdmin.storage.from('members').createSignedUrl(path, EXPIRES)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  signedCache.set(path, { url: data.signedUrl, at: Date.now() })
  return NextResponse.redirect(data.signedUrl)
}
