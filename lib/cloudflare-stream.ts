// Server-only helper for Cloudflare Stream (live input + signed playback).
// Never import this from a client component: it reads secrets.
//
// Env (set in Vercel -> Project -> Settings -> Environment Variables):
//   CLOUDFLARE_ACCOUNT_ID            your Cloudflare account id
//   CLOUDFLARE_STREAM_TOKEN          API token with Stream: Edit permission
//   CLOUDFLARE_STREAM_CUSTOMER_CODE  the xxxx in customer-xxxx.cloudflarestream.com

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN
const CODE = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE

export const streamConfigured = () => Boolean(ACCOUNT && TOKEN && CODE)

type CfEnvelope<T> = { success: boolean; result: T; errors?: { message?: string }[] }

async function cf<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  })
  let body: CfEnvelope<T> | null = null
  try { body = (await res.json()) as CfEnvelope<T> } catch { /* non-JSON */ }
  if (!res.ok || !body?.success) {
    throw new Error(body?.errors?.[0]?.message || `Cloudflare error ${res.status}`)
  }
  return body.result
}

type LiveInput = { uid: string; rtmps?: { url: string; streamKey: string }; srt?: { url: string; streamId: string; passphrase: string } }

export async function createLiveInput(name: string) {
  const r = await cf<LiveInput>('/live_inputs', {
    method: 'POST',
    body: JSON.stringify({
      meta: { name },
      // Automatic recording keeps the match as a replay; signed URLs make both live and replay members-only.
      recording: { mode: 'automatic', requireSignedURLs: true },
    }),
  })
  return { uid: r.uid, url: r.rtmps?.url || '', key: r.rtmps?.streamKey || '' }
}

export async function getLiveInputCredentials(uid: string) {
  const r = await cf<LiveInput>(`/live_inputs/${encodeURIComponent(uid)}`)
  return { url: r.rtmps?.url || '', key: r.rtmps?.streamKey || '' }
}

type Recording = { uid: string; created?: string; status?: { state?: string } }

/** Newest finished recording of a live input, or null while it is still processing. */
export async function latestRecordingUid(liveInputUid: string): Promise<string | null> {
  const vids = await cf<Recording[]>(`/live_inputs/${encodeURIComponent(liveInputUid)}/videos`)
  const ready = (vids || []).filter(v => v.status?.state === 'ready')
  ready.sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')))
  return ready[0]?.uid ?? null
}

/** Short-lived playback token (valid for `ttlSeconds`). */
export async function signPlaybackToken(uid: string, ttlSeconds = 3 * 3600): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const r = await cf<{ token: string }>(`/${encodeURIComponent(uid)}/token`, { method: 'POST', body: JSON.stringify({ exp }) })
  return r.token
}

export const playerSrc = (token: string) => `https://customer-${CODE}.cloudflarestream.com/${token}/iframe?autoplay=true`

/** Delete the live input and every recording made from it. */
export async function deleteLiveInput(uid: string) {
  try {
    const vids = await cf<Recording[]>(`/live_inputs/${encodeURIComponent(uid)}/videos`)
    for (const v of vids || []) await cf(`/${encodeURIComponent(v.uid)}`, { method: 'DELETE' }).catch(() => {})
  } catch { /* nothing to delete */ }
  await cf(`/live_inputs/${encodeURIComponent(uid)}`, { method: 'DELETE' })
}
