import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { safeError, requireActiveUser, isAdmin } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

// Admin-only management of Ligue Féminine clubs.
//   POST   { name, username, password, logoPath }  -> creates the club AND its login
//   DELETE { id }                                  -> removes an EMPTY club and its login
//
// Creating a login for somebody else is an auth-admin operation, so this is the one
// place that needs the service-role key. Everything is checked as the verified admin
// caller first, and a club account is only ever created tied to exactly one club.

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/
const LOGO_RE = /^league\/logos\/[A-Za-z0-9._-]+$/

export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!isAdmin(auth.caller)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Creating club logins is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 501 })
    }
    const rl = await checkRateLimit(`league-teams:${auth.caller.id}`, { limit: 30, windowSeconds: 300 })
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const logoPath = typeof body.logoPath === 'string' && body.logoPath ? body.logoPath : null

    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Team name must be 2-80 characters' }, { status: 400 })
    if (!USERNAME_RE.test(username)) return NextResponse.json({ error: 'Username: 3-32 chars, letters/digits/._-' }, { status: 400 })
    if (password.length < 6 || password.length > 200) return NextResponse.json({ error: 'Password must be 6-200 characters' }, { status: 400 })
    if (logoPath && !LOGO_RE.test(logoPath)) return NextResponse.json({ error: 'Bad logo path' }, { status: 400 })

    const { data: taken } = await supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle()
    if (taken) return NextResponse.json({ error: 'Username taken' }, { status: 409 })

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('league_teams')
      .insert({ name, logo_path: logoPath, created_by: auth.caller.id })
      .select('id')
      .single()
    if (teamErr || !team) {
      const dup = teamErr && /duplicate key|league_teams_name_key/i.test(teamErr.message)
      return NextResponse.json({ error: dup ? 'A team with this name already exists' : safeError(teamErr, 'could not create team') }, { status: dup ? 409 : 500 })
    }

    const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: `${username}@placeholder.tunisia-wnt.local`,
      password,
      email_confirm: true,
      user_metadata: { username },
    })
    if (userErr || !created?.user) {
      await supabaseAdmin.from('league_teams').delete().eq('id', team.id)
      return NextResponse.json({ error: safeError(userErr, 'could not create login') }, { status: 500 })
    }

    const { error: profErr } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      username,
      first_name: name,
      last_name: '',
      role: 'club',
      status: 'active',
      permissions: {},
      league_team_id: team.id,
    })
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      await supabaseAdmin.from('league_teams').delete().eq('id', team.id)
      return NextResponse.json({ error: safeError(profErr, 'could not create profile') }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: team.id })
  } catch (e) {
    console.error('league-teams POST error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!isAdmin(auth.caller)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 501 })
    }

    const body = await req.json().catch(() => ({}))
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Bad team id' }, { status: 400 })

    const { count } = await supabaseAdmin.from('members').select('id', { count: 'exact', head: true }).eq('league_team_id', id)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'This team still has players. Remove them first.' }, { status: 409 })
    }

    // Only ever touch club logins tied to THIS team.
    const { data: logins } = await supabaseAdmin.from('profiles').select('id').eq('league_team_id', id).eq('role', 'club')
    for (const l of logins ?? []) {
      await supabaseAdmin.auth.admin.deleteUser(l.id) // cascades to the profile row
    }
    const { error } = await supabaseAdmin.from('league_teams').delete().eq('id', id)
    if (error) return NextResponse.json({ error: safeError(error, 'could not delete team') }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('league-teams DELETE error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
