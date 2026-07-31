import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  try {
    const { firstName, lastName, username, password } = await req.json()

    if (!firstName?.trim() || !lastName?.trim() || !username?.trim() || !password) {
      return NextResponse.json({ error: 'Fill all fields' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password min 6 chars' }, { status: 400 })
    }

    const uname = username.trim().toLowerCase()

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', uname)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Username taken' }, { status: 400 })
    }

    const placeholderEmail = `${uname}@placeholder.tunisia-wnt.local`

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: placeholderEmail,
      password,
      email_confirm: true,
      user_metadata: { username: uname },
    })
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message || 'Could not create account' }, { status: 500 })
    }

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      username: uname,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: 'staff',
      status: 'pending',
      permissions: {
        addMatch: false, useScout: false, addPlayer: false,
        editPlayer: false, exportData: false, deleteMatch: false, deletePlayer: false,
      },
    })
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
