import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { safeError } from '@/lib/api-auth'

// Simple in-memory throttle to slow down mass account creation.
const attempts = new Map<string, { count: number; reset: number }>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 10

function throttled(ip: string): boolean {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now > rec.reset) {
    attempts.set(ip, { count: 1, reset: now + WINDOW_MS })
    return false
  }
  rec.count++
  return rec.count > MAX_PER_HOUR
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    if (throttled(ip)) {
      return NextResponse.json({ error: 'Too many signup attempts. Try again later.' }, { status: 429 })
    }

    const { firstName, lastName, username, password, role } = await req.json()
    const r = role === "player" ? "player" : role === "staff" ? "staff" : null
    if (!r) return NextResponse.json({ error: 'Choose a role (Staff or Player)' }, { status: 400 })
    if (!firstName?.trim() || !lastName?.trim() || !username?.trim() || !password) {
      return NextResponse.json({ error: 'Fill all fields' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 200) {
      return NextResponse.json({ error: 'Password must be 6-200 characters' }, { status: 400 })
    }

    let uname = String(username).trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,32}$/.test(uname)) {
      return NextResponse.json({ error: 'Username: 3-32 chars, letters/digits/._-' }, { status: 400 })
    }
    uname = uname.toLowerCase()

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

    // status is always 'pending' and permissions always empty: a self-registered
    // account must never be able to grant itself rights.
    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      username: uname,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: r,
      status: 'pending',
      permissions: {
        addMatch: false, addPlayer: false,
        editPlayer: false, exportData: false, deleteMatch: false, deletePlayer: false,
      },
    })
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: safeError(profileErr, 'Could not create account') }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: 'pending' })
  } catch (e) {
    return NextResponse.json({ error: safeError(e) }, { status: 500 })
  }
}
