import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Caller = { id: string; username: string; role: string; status: string; permissions: Record<string, unknown> }

export type AuthResult = { ok: true; caller: Caller; token: string } | { ok: false; status: number; error: string }

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * A Supabase client that acts as the CALLER rather than as the server.
 *
 * Every query runs with the caller's own JWT, so Postgres RLS applies the
 * caller's real permissions. This is why the app needs no service-role key:
 * a request that the caller is not entitled to make is refused by the
 * database, not by this code.
 */
export function userClient(token: string): SupabaseClient {
  return createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Safe error string for API responses — never leak raw exceptions. */
export function safeError(e: unknown, fallback = 'Server error'): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = String((e as { message: unknown }).message)
    return m.length > 0 && m.length < 200 ? m : fallback
  }
  return fallback
}

function bearer(req: Request): string {
  const auth = req.headers.get('authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

/** The caller's raw JWT, or '' when absent. */
export function bearerToken(req: Request): string {
  return bearer(req)
}

/**
 * Verify the caller from the Authorization header and load their profile.
 * Rejects: no token, invalid token, no profile, or status !== 'active'.
 */
export async function requireActiveUser(req: Request): Promise<AuthResult> {
  const token = bearer(req)
  if (!token) return { ok: false, status: 401, error: 'Not authenticated' }

  // Verified as the caller, not with any server-side privileged key.
  const asCaller = userClient(token)

  const { data, error } = await asCaller.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Not authenticated' }

  // Reading the caller's own profile row is allowed by RLS (auth.uid() = id).
  const { data: profile } = await asCaller
    .from('profiles')
    .select('id,username,role,status,permissions')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) return { ok: false, status: 403, error: 'No profile' }
  if (profile.status !== 'active') return { ok: false, status: 403, error: 'Account not active' }

  return {
    ok: true,
    token,
    caller: {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      status: profile.status,
      permissions: (profile.permissions || {}) as Record<string, unknown>,
    },
  }
}

export function isAdmin(caller: Caller): boolean {
  return caller.role === 'admin'
}

/** Admins may do anything; staff need the named permission flag. */
export function can(caller: Caller, permission: string): boolean {
  if (isAdmin(caller)) return true
  return caller.permissions?.[permission] === true
}
