import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, mailerConfigured } from '@/lib/mailer'

// Public route — the whole point is that a logged-out user can reach it.
// No Authorization header to check here, unlike every other API route in
// this app.
export async function POST(req: Request) {
  try {
    if (!mailerConfigured()) {
      return NextResponse.json(
        { error: "Email delivery isn't configured yet — ask an admin to reset your password" },
        { status: 501 },
      )
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Password reset is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 501 })
    }

    const { username, email } = await req.json()
    if (typeof username !== 'string' || typeof email !== 'string') {
      return NextResponse.json({ error: 'Username and email required' }, { status: 400 })
    }
    const uname = username.trim().toLowerCase()
    const mail = email.trim().toLowerCase()

    // Generic response either way — never reveal whether a username or
    // email exists. We only do real work (and only email the ADDRESS ON
    // FILE, never the one the caller typed, in case they typo'd someone
    // else's) when both match the same row.
    const generic = { ok: true, message: 'If that username and email match an account, a reset link has been sent.' }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, status')
      .eq('username', uname)
      .maybeSingle()

    if (!profile || !profile.email || profile.email.toLowerCase() !== mail || profile.status !== 'active') {
      return NextResponse.json(generic)
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { error: insertErr } = await supabaseAdmin.from('password_reset_tokens').insert({
      profile_id: profile.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    if (insertErr) {
      console.error('forgot-password insert error:', insertErr)
      return NextResponse.json(generic)
    }

    const origin = req.headers.get('origin') || new URL(req.url).origin
    const resetLink = `${origin}/reset-password?token=${rawToken}`

    const { error: mailErr } = await sendEmail({
      to: profile.email,
      subject: 'Reset your Tunisia WNT password',
      html: `
        <p>A password reset was requested for your Tunisia WNT — Elite Squad Manager account.</p>
        <p><a href="${resetLink}">Click here to set a new password</a> (expires in 30 minutes).</p>
        <p>If you didn't request this, you can ignore this email — your password won't change.</p>
      `,
    })
    if (mailErr) console.error('forgot-password sendEmail error:', mailErr)

    return NextResponse.json(generic)
  } catch (e) {
    console.error('forgot-password error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
