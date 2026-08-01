import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token)
    if (callerErr || !callerData?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role,status')
      .eq('id', callerData.user.id)
      .maybeSingle()

    if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.status !== 'active') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { username, newPassword } = await req.json()
    if (!username || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Invalid input (password min 6 chars)' }, { status: 400 })
    }

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle()
    if (!targetProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetProfile.id, {
      password: newPassword,
    })
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
