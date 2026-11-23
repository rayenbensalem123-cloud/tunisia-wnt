import { NextResponse } from 'next/server'
import { gate, fail } from '@/lib/stream-route'
import { createLiveInput, deleteLiveInput } from '@/lib/cloudflare-stream'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const g = await gate(req, true)
  if ('res' in g) return g.res
  const rl = await checkRateLimit(`stream-start:${g.auth.caller.id}`, { limit: 10, windowSeconds: 600 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({})) as { title?: string; description?: string; teamCategory?: string | null }
  const title = String(body.title || '').trim().slice(0, 120)
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  let live
  try { live = await createLiveInput(title) } catch (e) { return fail(e) }

  const { data, error } = await g.db.from('library_videos').insert({
    title,
    description: String(body.description || '').trim().slice(0, 300),
    kind: 'live',
    team_category: body.teamCategory || null,
    source: 'stream',
    live_input_uid: live.uid,
    created_by_username: g.auth.caller.username,
  }).select('id').single()
  if (error || !data) {
    await deleteLiveInput(live.uid).catch(() => {}) // do not leave an orphan live input behind
    return NextResponse.json({ error: 'Could not save the stream' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id, url: live.url, key: live.key })
}
