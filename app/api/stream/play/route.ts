import { NextResponse } from 'next/server'
import { gate, loadStreamRow, fail } from '@/lib/stream-route'
import { latestRecordingUid, playerSrc, signPlaybackToken } from '@/lib/cloudflare-stream'

export const runtime = 'nodejs'

// Any ACTIVE account may watch. The row is read as the caller, so RLS is the real gate;
// the token is short-lived and is never stored.
export async function POST(req: Request) {
  const g = await gate(req, false)
  if ('res' in g) return g.res
  const { id } = await req.json().catch(() => ({}))
  const row = await loadStreamRow(g.db, id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    // Live now: play the live input. Finished: play the newest ready recording.
    const uid = row.kind === 'live' ? row.live_input_uid! : await latestRecordingUid(row.live_input_uid!)
    if (!uid) return NextResponse.json({ error: 'processing' }, { status: 409 })
    return NextResponse.json({ src: playerSrc(await signPlaybackToken(uid)) })
  } catch (e) { return fail(e) }
}
