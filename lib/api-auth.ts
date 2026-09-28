import { supabaseAdmin } from './supabase-admin'

export type Caller = { id: string; username: string; role: string; status: string; permissions: Record<string, unknown> }

export type AuthResult = { ok: true; caller: Caller } | { ok: false; status: number; error: string }

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

/**
 * Verify the caller from the Authorization header and load their profile.
 * Rejects: no token, invalid token, no profile, or status !== 'active'.
 */
export async function requireActiveUser(req: Request): Promise<AuthResult> {
  const token = bearer(req)
  if (!token) return { ok: false, status: 401, error: 'Not authenticated' }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Not authenticated' }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id,username,role,status,permissions')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) return { ok: false, status: 403, error: 'No profile' }
  if (profile.status !== 'active') return { ok: false, status: 403, error: 'Account not active' }

  return {
    ok: true,
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
