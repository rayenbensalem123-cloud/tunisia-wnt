import { supabase } from "@/lib/supabase"

// Every authenticated fetch() to an internal API route must carry the
// caller's Supabase access token as `Authorization: Bearer <token>`, because
// `requireActiveUser` (lib/api-auth.ts) rejects requests without one. This
// exact omission — a fetch to a protected route with no Authorization
// header — caused two real silent-401 bugs in one session, each fixed by a
// near-identical copy-pasted helper. Centralizing it here makes that
// mistake harder to repeat: there is now exactly one place to get it right.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}
