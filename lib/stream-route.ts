import { NextResponse } from 'next/server'
import { requireActiveUser, userClient, safeError } from '@/lib/api-auth'
import { streamConfigured } from '@/lib/cloudflare-stream'

export type StreamRow = { id: number; source: string; kind: string; live_input_uid: string | null; title: string }

/** Shared gate for the stream routes: signed-in active user, optionally admin-only, streaming configured. */
export async function gate(req: Request, adminOnly: boolean) {
  const auth = await requireActiveUser(req)
  if (!auth.ok) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) } as const
  if (adminOnly && auth.caller.role !== 'admin') return { res: NextResponse.json({ error: 'Admins only' }, { status: 403 }) } as const
  if (!streamConfigured()) return { res: NextResponse.json({ error: 'not_configured' }, { status: 503 }) } as const
  return { auth, db: userClient(auth.token) } as const
}

/** Load one stream row as the caller (RLS decides whether they may see it). */
export async function loadStreamRow(db: ReturnType<typeof userClient>, id: unknown): Promise<StreamRow | null> {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return null
  const { data } = await db.from('library_videos').select('id,source,kind,live_input_uid,title').eq('id', n).maybeSingle()
  return data && data.source === 'stream' && data.live_input_uid ? (data as StreamRow) : null
}

export const fail = (e: unknown) => NextResponse.json({ error: safeError(e, 'Streaming service error') }, { status: 502 })
