import { supabase } from './supabase'

// ─────────────────────────────────────────────
// FIELD MAPPING: DB (snake_case) <-> App (camelCase)
// ─────────────────────────────────────────────
export const memberFromDb = (r: any) => ({
  id: r.id,
  role: r.role,
  name: r.name,
  position: r.position,
  teamCategory: r.team_category,
  club: r.club,
  foot: r.foot,
  nationality: r.nationality,
  languages: r.languages,
  birthdate: r.birthdate,
  height: r.height,
  goals: r.goals,
  assists: r.assists,
  cleansheets: r.clean_sheets,
  yellowCards: r.yellow_cards,
  redCards: r.red_cards,
  suspended: r.suspended,
  contract: r.contract,
  natMatches: r.nat_matches,
  history: r.history || [],
  image: r.image_url,
  imagePath: r.image_path,
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
})

export const memberToDb = (m: any) => ({
  id: typeof m.id === 'number' && m.id < 2147483647 ? m.id : undefined,
  role: m.role,
  name: m.name,
  position: m.position,
  team_category: m.teamCategory,
  club: m.club,
  foot: m.foot,
  nationality: m.nationality,
  languages: m.languages,
  birthdate: m.birthdate,
  height: m.height,
  goals: m.goals != null ? String(m.goals) : null,
  assists: m.assists != null ? String(m.assists) : null,
  clean_sheets: m.cleansheets || 0,
  yellow_cards: m.yellowCards || 0,
  red_cards: m.redCards || 0,
  suspended: !!m.suspended,
  contract: m.contract,
  nat_matches: m.natMatches != null ? String(m.natMatches) : null,
  history: m.history || [],
  image_url: m.image || null,
  image_path: m.imagePath || null,
})

export const matchFromDb = (r: any) => ({
  id: r.id,
  opponent: r.opponent,
  date: r.match_date,
  competition: r.competition,
  teamCategory: r.category,
  ...(r.details || {}),
})

export const matchToDb = (m: any) => {
  const { id, opponent, date, competition, teamCategory, ...rest } = m
  return {
    id: typeof id === 'number' && id < 2147483647 ? id : undefined,
    opponent: opponent || null,
    match_date: date || null,
    competition: competition || null,
    category: teamCategory || null,
    details: rest,
  }
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
export async function getEmailForUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_login_email', { p_username: username.trim().toLowerCase() })
  if (error) return null
  return data || null
}

export async function signInUsername(username: string, password: string) {
  const email = await getEmailForUsername(username)
  if (!email) return { error: 'User not found' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Wrong password' }
  return { error: null }
}

export async function fetchMyProfile() {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  if (!uid) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
  if (error || !data) return null
  return data
}

export async function registerUser(payload: { firstName: string; lastName: string; username: string; password: string }) {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

// User changes their own password (works from any device, applies immediately)
export async function changeMyPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error: error?.message || null }
}

// Admin resets someone else's password (server-verified admin check)
export async function adminResetPassword(username: string, newPassword: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Not authenticated' }
  const res = await fetch('/api/admin-reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ username, newPassword }),
  })
  const json = await res.json()
  return { error: json.error || null }
}

// Admin-only activity log (who changed what, when)
export async function fetchActivityLog(limit = 100) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('fetchActivityLog', error); return [] }
  return data
}

// ─────────────────────────────────────────────
// INJURIES (medical history — never deleted, just status changes)
// ─────────────────────────────────────────────
export async function fetchInjuries(memberId: number) {
  const { data, error } = await supabase
    .from('injuries')
    .select('*')
    .eq('member_id', memberId)
    .order('occurred_on', { ascending: false })
  if (error) { console.error('fetchInjuries', error); return [] }
  return data
}

export async function addInjury(memberId: number, payload: {
  injury_type: string; body_part?: string; severity?: string
  occurred_on?: string; expected_return?: string; notes?: string
}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  let username: string | null = null
  if (uid) {
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
    username = profile?.username || null
  }
  const { error } = await supabase.from('injuries').insert({
    member_id: memberId, status: 'active', logged_by: uid, logged_by_username: username, ...payload,
  })
  return { error: error?.message || null }
}

export async function updateInjuryStatus(injuryId: number, status: 'active' | 'recovering' | 'recovered') {
  const { error } = await supabase.from('injuries').update({ status, updated_at: new Date().toISOString() }).eq('id', injuryId)
  return { error: error?.message || null }
}

// ─────────────────────────────────────────────
// PROFILES (admin-only management)
// ─────────────────────────────────────────────
export async function fetchAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) return []
  return data
}

export async function updateProfile(username: string, patch: any) {
  const { error } = await supabase.from('profiles').update(patch).eq('username', username)
  return { error }
}

export async function deleteProfile(username: string) {
  const { error } = await supabase.from('profiles').delete().eq('username', username)
  return { error }
}

// ─────────────────────────────────────────────
// MEMBERS / MATCHES: fetch + diff-based sync
// (Each row is inserted/updated/deleted individually so
//  Postgres RLS enforces per-user permissions on every write.)
// ─────────────────────────────────────────────
export async function fetchMembers() {
  const { data, error } = await supabase.from('members').select('*')
  if (error) { console.error('fetchMembers', error); return [] }
  return data.map(memberFromDb)
}

export async function fetchMatches() {
  const { data, error } = await supabase.from('matches').select('*')
  if (error) { console.error('fetchMatches', error); return [] }
  return data.map(matchFromDb)
}

async function diffSync(
  table: 'members' | 'matches',
  prevMap: Map<any, any>,
  nextList: any[],
  toDb: (x: any) => any
) {
  const nextMap = new Map(nextList.map((x) => [x.id, x]))
  const inserts: any[] = []
  const updates: { id: any; row: any }[] = []
  const deletes: any[] = []

  for (const [id, item] of nextMap) {
    const prevItem = prevMap.get(id)
    if (!prevItem) {
      // New row. If id looks like a client-generated timestamp (too big for int4), let DB assign a real id.
      const row = toDb(item)
      inserts.push(row)
    } else if (JSON.stringify(prevItem) !== JSON.stringify(item)) {
      updates.push({ id, row: toDb(item) })
    }
  }
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) deletes.push(id)
  }

  const results: any[] = []
  if (inserts.length) {
    const rows = inserts.map((r) => { const { id, ...rest } = r; return rest })
    const { data, error } = await supabase.from(table).insert(rows).select()
    if (error) console.error(`${table} insert err`, error)
    else results.push(...data)
  }
  for (const u of updates) {
    const { id, ...rest } = u.row
    const { error } = await supabase.from(table).update(rest).eq('id', u.id)
    if (error) console.error(`${table} update err`, error)
  }
  if (deletes.length) {
    const { error } = await supabase.from(table).delete().in('id', deletes)
    if (error) console.error(`${table} delete err`, error)
  }
  return results
}

export async function syncMembers(prevMap: Map<any, any>, nextList: any[]) {
  return diffSync('members', prevMap, nextList, memberToDb)
}
export async function syncMatches(prevMap: Map<any, any>, nextList: any[]) {
  return diffSync('matches', prevMap, nextList, matchToDb)
}

// ─────────────────────────────────────────────
// REALTIME
// ─────────────────────────────────────────────
export async function subscribeRealtime(handlers: {
  onMembers?: () => void
  onMatches?: () => void
  onProfiles?: () => void
}) {
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) {
    await supabase.realtime.setAuth(data.session.access_token)
  }
  const channel = supabase
    .channel('app-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => handlers.onMembers?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => handlers.onMatches?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => handlers.onProfiles?.())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
