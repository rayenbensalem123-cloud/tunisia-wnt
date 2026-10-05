import { NextResponse } from 'next/server'
import { userClient, bearerToken } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Legacy Blob support is restricted to the official Blob hosts.
// Any other host would turn this route into an open proxy and would leak
// BLOB_READ_WRITE_TOKEN to a third party.
const BLOB_HOSTS = ['blob.vercel-storage.com', '.public.blob.vercel-storage.com']
const BLOB_PATH_RE = /^\/store\/[\w-]+\/[^/]+/

// Signed URLs are minted for a specific caller, so the cache is keyed by
// user id as well - never hand one user's signed URL to another.
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

// A passport scan belongs to exactly one member. The storage policy refuses to
// sign anybody else's, so RLS is the real enforcement -- but this route takes a
// caller-supplied path and signs as that caller, so it is worth deciding here
// too: it keeps a path leaked out of the members table from being sufficient
// on its own, and puts the rule in one readable place.
//
// Everything that is not a passport (squad photos, camp photos, camp reports)
// stays readable by any active account. A player reads its own passport and
// nobody else's; staff need viewMedical; admins have it implicitly.
async function mayReadObject(
  c: ReturnType<typeof userClient>,
  userId: string,
  path: string
): Promise<boolean> {
  const { data: prof } = await c
    .from('profiles')
    .select('role, permissions, member_id')
    .eq('id', userId)
    .maybeSingle()
  if (!prof) return false
  // Mirror has_permission(), which compares `permissions ->> perm` to the
  // string 'true'. jsonb normally holds a real boolean here, but a quoted
  // "true" would silently deny staff the passport tab rather than allow it.
  const vm = prof.permissions?.viewMedical as boolean | string | undefined
  if (prof.role === 'admin' || vm === true || vm === 'true') return true

  const { data: owners } = await c
    .from('members')
    .select('id')
    .eq('passport_image', path)
    .limit(1)
  const owner = owners?.[0]
  if (!owner) return true // not a passport
  return prof.role === 'player' && prof.member_id != null && prof.member_id === owner.id
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

  // Signing happens as the caller, so the storage RLS policy
  // (current_active_user) is what authorises reading this object.
  const token = bearerToken(req)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const asCaller = userClient(token)
  const { data: userData, error: userErr } = await asCaller.auth.getUser(token)
  if (userErr || !userData?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!(await mayReadObject(asCaller, userData.user.id, path))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const cacheKey = `${userData.user.id}:${path}`

  const hit = signedCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.redirect(hit.url)
  }

  const EXPIRES = 60 * 60 // 1 hour
  const { data, error } = await asCaller.storage.from('members').createSignedUrl(path, EXPIRES)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  signedCache.set(cacheKey, { url: data.signedUrl, at: Date.now() })
  return NextResponse.redirect(data.signedUrl)
}
