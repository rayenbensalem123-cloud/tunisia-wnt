// Server-only Zoom API helper. Never import this from client code — it
// reads secrets that must stay off the browser bundle.
//
// Uses a Server-to-Server OAuth app (Zoom Marketplace → Build App), which is
// built for exactly this: a backend acting on a Zoom account's behalf with no
// per-user Zoom login. Needs ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.

export function zoomConfigured(): boolean {
  return !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET)
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getZoomToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token

  const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
  })
  if (!res.ok) throw new Error('Zoom auth failed')
  const data = await res.json()
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3000) * 1000 }
  return cachedToken.token
}

export async function zoomCreateMeeting(opts: { title: string; startTime: string }): Promise<{ id: string; joinUrl: string; startUrl: string }> {
  const token = await getZoomToken()
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: opts.title,
      type: 2, // scheduled
      start_time: opts.startTime,
      settings: { auto_recording: 'cloud', join_before_host: true },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Zoom meeting creation failed: ${res.status} ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return { id: String(data.id), joinUrl: data.join_url, startUrl: data.start_url }
}

/** Returns the share URL of the first available cloud recording, or null if none yet. */
export async function zoomGetRecordingUrl(zoomMeetingId: string): Promise<string | null> {
  const token = await getZoomToken()
  const res = await fetch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}/recordings`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null // not recorded (yet)
  if (!res.ok) throw new Error(`Zoom recordings lookup failed: ${res.status}`)
  const data = await res.json()
  return data.share_url || null
}
