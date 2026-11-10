import { NextResponse } from 'next/server'
import { gate, loadStreamRow, fail } from '@/lib/stream-route'
import { getLiveInputCredentials } from '@/lib/cloudflare-stream'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const g = await gate(req, true)
  if ('res' in g) return g.res
  const { id } = await req.json().catch(() => ({}))
  const row = await loadStreamRow(g.db, id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { return NextResponse.json(await getLiveInputCredentials(row.live_input_uid!)) } catch (e) { return fail(e) }
}
