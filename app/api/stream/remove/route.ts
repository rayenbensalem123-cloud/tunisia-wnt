import { NextResponse } from 'next/server'
import { gate, loadStreamRow, fail } from '@/lib/stream-route'
import { deleteLiveInput } from '@/lib/cloudflare-stream'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const g = await gate(req, true)
  if ('res' in g) return g.res
  const { id } = await req.json().catch(() => ({}))
  const row = await loadStreamRow(g.db, id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { await deleteLiveInput(row.live_input_uid!) } catch (e) {
    // Already gone at Cloudflare is fine: still remove the row so it can't get stuck.
    if (!/not found|does not exist|no such/i.test(String((e as Error)?.message || ''))) return fail(e)
  }
  const { error } = await g.db.from('library_videos').delete().eq('id', row.id)
  if (error) return NextResponse.json({ error: 'Could not delete' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
