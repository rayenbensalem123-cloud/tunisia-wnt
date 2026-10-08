import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Public route — reached from the emailed link while the user is signed
// out, so auth is the token itself, not a session.
export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Password reset is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 501 })
    }

    const { token, newPassword } = await req.json()
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 200) {
      return NextResponse.json({ error: 'Password must be 6-200 characters' }, { status: 400 })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: row } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, profile_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(row.profile_id, {
      password: newPassword,
    })
    if (updateErr) {
      console.error('reset-password updateUserById error:', updateErr)
      return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
    }

    // Burn the token whether or not this is the first use attempt — never
    // leave a live one-time link lying around once it's been consumed.
    await supabaseAdmin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('reset-password error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
