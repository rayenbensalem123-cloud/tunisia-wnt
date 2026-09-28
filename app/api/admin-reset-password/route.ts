import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { safeError, requireActiveUser, isAdmin, userClient } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    // Same gate as every other route: verified caller, loaded from their own
    // session. Cheaper to reason about than re-deriving admin-ness here.
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!isAdmin(auth.caller)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { username, newPassword } = await req.json()
    if (typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 200) {
      return NextResponse.json({ error: 'Password must be 6-200 characters' }, { status: 400 })
    }

    // Admins may read the full user list; RLS permits exactly this read.
    const { data: targetProfile } = await userClient(auth.token)
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle()
    if (!targetProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // This one call genuinely needs the service-role key: changing another
    // user's password is an auth-admin operation with no user-scoped equivalent.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Password reset is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured' },
        { status: 501 },
      )
    }
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetProfile.id, {
      password: newPassword,
    })
    if (updateErr) return NextResponse.json({ error: safeError(updateErr, 'reset failed') }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('admin-reset-password error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
