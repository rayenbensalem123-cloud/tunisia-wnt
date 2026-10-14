import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireActiveUser, safeError } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Returns the caller's personal calendar token, creating it on first use.
// POST {"regenerate": true} rotates it (old subscription link stops working).
// Used by the mobile app; the token itself is the credential for /api/calendar/<token>.ics.
export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await req.json().catch(() => ({}))
    const id = auth.caller.id
    if (!body?.regenerate) {
      const { data } = await supabaseAdmin.from('profiles').select('calendar_token').eq('id', id).maybeSingle()
      if (data?.calendar_token) return NextResponse.json({ token: data.calendar_token })
    }
    const token = randomBytes(24).toString('hex')
    const { error } = await supabaseAdmin.from('profiles').update({ calendar_token: token }).eq('id', id)
    if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
    return NextResponse.json({ token })
  } catch (e) {
    return NextResponse.json({ error: safeError(e) }, { status: 500 })
  }
}
