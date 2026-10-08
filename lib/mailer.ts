// Outbound email, server-only (only imported from app/api/* route handlers,
// never from client code — no "server-only" package pulled in, to avoid
// touching pnpm-lock.yaml for a one-line guard). Uses Resend's plain HTTP
// API via fetch, so no extra dependency either. Guarded on RESEND_API_KEY
// exactly like lib/zoom.ts is guarded on the Zoom env vars: missing config
// degrades to a clear error, never a crash or a silent no-op.

export function mailerConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

const FROM = process.env.RESEND_FROM_EMAIL || 'Tunisia WNT <onboarding@resend.dev>'

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ error: string | null }> {
  if (!mailerConfigured()) return { error: 'Email delivery is not configured' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('sendEmail failed', res.status, body)
      return { error: 'Email send failed' }
    }
    return { error: null }
  } catch (e) {
    console.error('sendEmail error', e)
    return { error: 'Email send failed' }
  }
}
