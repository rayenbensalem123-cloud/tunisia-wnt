import { supabase } from './supabase'

// ─────────────────────────────────────────────
// PRIVATE STORAGE
// The 'members' bucket is private, so an <img src> can never point straight
// at it. Instead we mint a short-lived signed URL with the signed-in user's
// own session: the storage RLS policy (current_active_user) decides whether
// they may read the object at all, and no service-role key is involved.
// ─────────────────────────────────────────────
const SIGN_TTL_MS = 50 * 60 * 1000 // refresh well before the 1h expiry
const signedCache = new Map<string, { url: string; at: number }>()

export async function signedImageUrl(path: string): Promise<string> {
  if (!path) return ''
  const hit = signedCache.get(path)
  if (hit && Date.now() - hit.at < SIGN_TTL_MS) return hit.url
  const { data, error } = await supabase.storage.from('members').createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return ''
  signedCache.set(path, { url: data.signedUrl, at: Date.now() })
  return data.signedUrl
}

/** Resolve many storage paths at once, skipping ones already cached. */
export async function signedImageUrls(paths: string[]): Promise<Record<string, string>> {
  const wanted = Array.from(new Set(paths.filter(Boolean)))
  const out: Record<string, string> = {}
  await Promise.all(
    wanted.map(async (p) => {
      const u = await signedImageUrl(p)
      if (u) out[p] = u
    }),
  )
  return out
}

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
  jerseyNumber: r.jersey_number != null ? r.jersey_number : null,
  fifaConnectId: r.fifa_connect_id || null,
  camps: r.camps || [],
  passportImage: r.passport_image || null,
  bioQuote: r.bio_quote,
  leagueRegion: r.league_region,
  dualNationality: r.dual_nationality,
  secondNationality: r.second_nationality,
  formation: r.formation,
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
  jersey_number: m.jerseyNumber != null ? Number(m.jerseyNumber) : null,
  fifa_connect_id: m.fifaConnectId ? String(m.fifaConnectId).trim() : null,
  camps: Array.isArray(m.camps) ? m.camps : [],
  passport_image: m.passportImage || null,
  // passport_number is deliberately absent. Nothing on a squad page needs the
  // document number, and sending a column the table may not have turns every
  // save into a PGRST204.
  bio_quote: m.bioQuote || null,
  league_region: m.leagueRegion || null,
  dual_nationality: !!m.dualNationality,
  second_nationality: m.secondNationality || null,
  // Staff's "Preferred Tactics / Formation" picker had nowhere to save to —
  // the column didn't exist and this mapper never listed it, so every
  // selection was silently discarded. Both are now in place.
  formation: m.formation || null,
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

export const campFromDb = (r: any) => ({
  id: r.id,
  name: r.name || '',
  location: r.location || '',
  startDate: r.start_date || '',
  endDate: r.end_date || '',
  teamCategory: r.team_category || '',
  program: Array.isArray(r.program) ? r.program : [],
  players: Array.isArray(r.players) ? r.players : [],
  staff: Array.isArray(r.staff) ? r.staff : [],
  staffRoles: Array.isArray(r.staff_roles) ? r.staff_roles : [],
  reportUrl: r.report_url || '',
  reportName: r.report_name || '',
  images: Array.isArray(r.images) ? r.images : [],
  createdByUsername: r.created_by_username || '',
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
})

export const campToDb = (c: any) => ({
  id: typeof c.id === 'number' && c.id < 2147483647 ? c.id : undefined,
  name: c.name || '',
  location: c.location || '',
  start_date: c.startDate || '',
  end_date: c.endDate || '',
  team_category: c.teamCategory || '',
  program: Array.isArray(c.program) ? c.program : [],
  players: Array.isArray(c.players) ? c.players : [],
  staff: Array.isArray(c.staff) ? c.staff : [],
  staff_roles: Array.isArray(c.staffRoles) ? c.staffRoles : [],
  report_url: c.reportUrl || '',
  report_name: c.reportName || '',
  images: Array.isArray(c.images) ? c.images : [],
  created_by_username: c.createdByUsername || null,
})

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

// Self-registration runs entirely on the signed-in user's own session, so it
// needs no service-role key. The DB (guard_profile_insert) forces the account
// to status='pending' with empty permissions regardless of what we send.
export async function registerUser(payload: { firstName: string; lastName: string; username: string; password: string; role: "staff" | "player" }) {
  const username = payload.username.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { error: 'Username: 3-32 chars, letters/digits/._-' }
  }
  if (typeof payload.password !== 'string' || payload.password.length < 6) {
    return { error: 'Password min 6 chars' }
  }

  const email = `${username}@placeholder.tunisia-wnt.local`
  const { data, error: signUpErr } = await supabase.auth.signUp({
    email,
    password: payload.password,
    options: { data: { username } },
  })
  if (signUpErr) {
    if (/already registered|already been registered/i.test(signUpErr.message)) {
      return { error: 'Username taken' }
    }
    return { error: signUpErr.message }
  }

  // No session means email confirmation is required for signUp.
  const session = data?.session
  if (!session) {
    return { error: 'Account created, but sign-in is blocked until email confirmation is disabled in Supabase → Authentication → Settings. Ask an admin to approve.' }
  }

  const { error: insertErr } = await supabase.from('profiles').insert({
    id: session.user.id,
    username,
    first_name: payload.firstName.trim(),
    last_name: payload.lastName.trim(),
    role: payload.role,
    status: 'pending',
    permissions: {
      addMatch: false, addPlayer: false,
      editPlayer: false, exportData: false, deleteMatch: false, deletePlayer: false,
    },
  })
  if (insertErr) {
    if (/duplicate key|already exists/i.test(insertErr.message)) {
      return { error: 'Username taken' }
    }
    return { error: insertErr.message }
  }

  // Sign out: the account is pending and must not look logged in.
  await supabase.auth.signOut()
  return { ok: true, status: 'pending' }
}

// User changes their own password (works from any device, applies immediately)
export async function changeMyPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error: error?.message || null }
}

// Self-service: save/change the recovery email on the caller's own profile.
// Not guarded by guard_profile_privileges, so the existing "update own row"
// RLS policy already allows this — no new policy needed.
export async function updateMyEmail(email: string) {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  if (!uid) return { error: 'Not signed in' }
  const trimmed = email.trim()
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { error: 'Invalid email' }
  const { error } = await supabase.from('profiles').update({ email: trimmed || null }).eq('id', uid)
  if (error) return { error: /duplicate key|already exists/i.test(error.message) ? 'Email already in use' : error.message }
  return { error: null }
}

// Forgot-password, step 1: ask for a reset link. Always returns a generic
// message from the server regardless of whether the account/email matched,
// so this can't be used to enumerate usernames.
export async function requestPasswordReset(username: string, email: string) {
  const res = await fetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email }),
  })
  const json = await res.json().catch(() => ({}))
  return { error: res.ok ? null : (json.error || 'Request failed'), message: json.message as string | undefined }
}

// Forgot-password, step 2: the emailed link lands on /reset-password?token=…
// which calls this with the token and the chosen new password.
export async function completePasswordReset(token: string, newPassword: string) {
  const res = await fetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
  const json = await res.json().catch(() => ({}))
  return { error: res.ok ? null : (json.error || 'Reset failed') }
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

// Every injury record across the roster, for data-export and the welfare
// dashboard. RLS limits a non-medical caller to their own linked rows.
export async function fetchAllInjuries() {
  const { data, error } = await supabase
    .from('injuries')
    .select('*')
    .order('occurred_on', { ascending: false })
  if (error) { console.error('fetchAllInjuries', error); return [] }
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
// CLUB MATCH REPORTS (a player's self-logged stats from matches played
// with their CLUB, not the national team — minutes, goals, assists, cards)
// ─────────────────────────────────────────────
export async function fetchClubReports(memberId: number) {
  const { data, error } = await supabase
    .from('club_match_reports')
    .select('*')
    .eq('member_id', memberId)
    .order('match_date', { ascending: false })
  if (error) { console.error('fetchClubReports', error); return [] }
  return data
}

// Every club match report across the whole roster, for data-export use.
// RLS still applies: a caller without addPlayer/editPlayer/admin only ever
// gets their own linked rows back here, same as the per-member fetch above.
export async function fetchAllClubReports() {
  const { data, error } = await supabase
    .from('club_match_reports')
    .select('*')
    .order('match_date', { ascending: false })
  if (error) { console.error('fetchAllClubReports', error); return [] }
  return data
}

export async function addClubReport(memberId: number, payload: {
  match_date?: string; opponent?: string; competition?: string
  minutes_played?: number; goals?: number; assists?: number
  yellow_cards?: number; red_cards?: number; result?: string; notes?: string
  is_starting?: boolean; rating?: number; highlights_url?: string
  position_played?: string; did_not_play?: boolean
  had_injury?: boolean; injury_notes?: string
}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id || null
  const { error } = await supabase.from('club_match_reports').insert({
    member_id: memberId, submitted_by: uid, ...payload,
  })
  return { error: error?.message || null }
}

export async function deleteClubReport(id: number) {
  const { error } = await supabase.from('club_match_reports').delete().eq('id', id)
  return { error: error?.message || null }
}

// Staff-only in practice: trg_guard_club_report_verification blocks anyone
// without editPlayer/addPlayer/admin from touching these three columns,
// even though a player can otherwise update her own report.
export async function verifyClubReport(id: number, verified: boolean, byUsername: string) {
  const { error } = await supabase.from('club_match_reports').update({
    verified,
    verified_by_username: verified ? byUsername : null,
    verified_at: verified ? new Date().toISOString() : null,
  }).eq('id', id)
  return { error: error?.message || null }
}

// ─────────────────────────────────────────────
// MEETINGS (Zoom-backed) — scheduling and recording lookup go through the
// /api/zoom/* routes, which hold the Zoom secret server-side. These two are
// plain RLS-protected reads/writes like everything else above.
// ─────────────────────────────────────────────
export async function fetchMeetings() {
  const { data, error } = await supabase.from('meetings').select('*').order('scheduled_at', { ascending: false })
  if (error) { console.error('fetchMeetings', error); return [] }
  return data
}

export async function deleteMeeting(id: number) {
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  return { error: error?.message || null }
}

async function authedPost(path: string, body: any) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { error: 'Not signed in' }
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: data.error || `Request failed (${res.status})` }
  return data
}

export async function scheduleMeeting(payload: { title: string; scheduledAt: string; teamCategory?: string | null }) {
  return authedPost('/api/zoom/schedule', payload)
}

export async function checkMeetingRecording(meetingId: number) {
  return authedPost('/api/zoom/recording', { meetingId })
}

// ─────────────────────────────────────────────
// SQUAD TEMPLATES (Squad Lab — save/load formations & lineups)
// ─────────────────────────────────────────────
export async function fetchSquadTemplates(teamCategory: string) {
  const { data, error } = await supabase
    .from('squad_templates')
    .select('*')
    .eq('team_category', teamCategory)
    .order('updated_at', { ascending: false })
  if (error) { console.error('fetchSquadTemplates', error); return [] }
  return data
}

export async function saveSquadTemplate(payload: { teamCategory: string; name: string; formation: string; slots: Record<string, number | null> }) {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  let username: string | null = null
  if (uid) {
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
    username = profile?.username || null
  }
  const { data, error } = await supabase.from('squad_templates').insert({
    team_category: payload.teamCategory,
    name: payload.name,
    formation: payload.formation,
    slots: payload.slots,
    created_by: uid,
    created_by_username: username,
  }).select().single()
  return { data, error: error?.message || null }
}

export async function deleteSquadTemplate(id: number) {
  const { error } = await supabase.from('squad_templates').delete().eq('id', id)
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

/**
 * Point an account at its own player card. Admin-only: the
 * guard_profile_privileges trigger refuses member_id changes from
 * anyone who is not an active admin.
 * Pass null to unlink.
 */
export async function linkProfileToMember(username: string, memberId: number | null) {
  return updateProfile(username, { member_id: memberId })
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
/**
 * The roster.
 *
 * RLS refuses any anon read of the members table, which is deliberate: the
 * table holds passport_image. The public squad page therefore reads
 * squad_public, a view carrying every column a card renders except the
 * passport. Signed-in staff read the table itself, because they need
 * passport_image and because a row read from the view has no passport path -
 * saving that back would blank the document on disk.
 */
export async function fetchMembers() {
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session) {
    // RLS decides what this caller may see: a 'player' account gets only the
    // row linked to it, staff/admin get the whole table. There is deliberately
    // NO fallback to squad_public here. That view reads as its owner, so the
    // table's RLS is not re-applied through it — falling back would hand a
    // player the entire roster.
    const { data, error } = await supabase.from('members').select('*')
    if (error) { console.error('fetchMembers', error); return [] }
    return (data ?? []).map(memberFromDb)
  }
  const { data, error } = await supabase.from('squad_public').select('*')
  if (error) { console.error('fetchMembers', error); return [] }
  return (data ?? []).map(memberFromDb)
}

export async function fetchMatches() {
  const { data, error } = await supabase.from('matches').select('*')
  if (error) { console.error('fetchMatches', error); return [] }
  return (data ?? []).map(matchFromDb)
}

export async function fetchCamps() {
  const { data, error } = await supabase.from('camps').select('*')
  if (error) { console.error('fetchCamps', error); return [] }
  return (data ?? []).map(campFromDb)
}

async function diffSync(
  table: 'members' | 'matches' | 'camps',
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

  // SAFETY: never let a failed/empty read wipe the table.
  // An empty (or suspiciously huge) diff means the read didn't return real
  // data — deleting on that basis destroyed the whole squad once already.
  if (deletes.length > 0 && prevMap.size > 0) {
    const wipeAll = nextList.length === 0
    const wipeMost = deletes.length / prevMap.size > 0.5
    if (wipeAll || wipeMost) {
      console.warn(
        `[sync] ${table}: refusing to delete ${deletes.length}/${prevMap.size} rows — read looks incomplete`
      )
      deletes.length = 0
    }
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
export async function syncCamps(prevMap: Map<any, any>, nextList: any[]) {
  return diffSync('camps', prevMap, nextList, campToDb)
}

// ─────────────────────────────────────────────
// REALTIME
// ─────────────────────────────────────────────
export async function subscribeRealtime(handlers: {
  onMembers?: () => void
  onMatches?: () => void
  onProfiles?: () => void
  onCamps?: () => void
}) {
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) {
    await supabase.realtime.setAuth(data.session.access_token)
  }
  const channel = supabase
    .channel('app-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => handlers.onMembers?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => handlers.onMatches?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'camps' }, () => handlers.onCamps?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => handlers.onProfiles?.())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
