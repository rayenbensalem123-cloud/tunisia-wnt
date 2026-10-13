import { kv } from '@vercel/kv'

export type RateLimitResult = { ok: boolean; retryAfterSeconds?: number }

/**
 * Simple fixed-window rate limiter backed by Vercel KV (INCR + EXPIRE).
 *
 * `@vercel/kv` throws when KV_REST_API_URL / KV_REST_API_TOKEN aren't set,
 * which is the case in any environment that hasn't provisioned a KV store
 * (local dev, preview deploys without the integration, etc). We fail OPEN
 * in that case rather than blocking real traffic: the same
 * graceful-degradation pattern as `mailerConfigured()` in lib/mailer.ts —
 * an unconfigured rate limiter should never be the reason a legitimate user
 * can't reset their password or upload a file. It only ever makes requests
 * *stricter* once it's actually wired up.
 */
export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return { ok: true }
    }

    const count = await kv.incr(key)
    if (count === 1) {
      await kv.expire(key, opts.windowSeconds)
    }

    if (count > opts.limit) {
      return { ok: false, retryAfterSeconds: opts.windowSeconds }
    }

    return { ok: true }
  } catch (e) {
    console.error('checkRateLimit error (failing open):', e)
    return { ok: true }
  }
}
