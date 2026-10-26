import { supabase } from './supabase'
import { authHeaders } from './auth-headers'

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
  image2: r.image2_url,
  image2Path: r.image2_path,
  jerseyNumber: r.jersey_number != null ? r.jersey_number : null,
  fifaConnectId: r.fifa_connect_id || null,
  leagueTeamId: r.league_team_id ?? null,
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
  // Only sent for Ligue players, so a database without the 0012 migration keeps
  // saving every other card exactly as before.
  ...(m.leagueTeamId != null ? { league_team_id: Number(m.leagueTeamId) } : {}),
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
  // Celebration photo. Only sent once a member carries the field, so a database that has
  // not had migrations/0007_celebration_photo.sql yet never sees an unknown column (PGRST204).
  ...(m.image2 !== undefined || m.image2Path !== undefined
    ? { image2_url: m.image2 || null, image2_path: m.image2Path || null }
    : {}),
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
  country: r.country || '',
  state: r.state || '',
  hotel: r.hotel || '',
  arrivalDate: r.arrival_date || '',
  departureDate: r.departure_date || '',
  startDate: r.start_date || '',
  endDate: r.end_date || '',
  teamCategory: r.team_category || '',
  program: Array.isArray(r.program) ? r.program : [],
  players: Array.isArray(r.players) ? r.players : [],
  staff: Array.isArray(r.staff) ? r.staff : [],
  staffRoles: Array.isArray(r.staff_roles) ? r.staff_roles : [],
  reportUrl: r.report_url || '',
  reportName: r.report_name || '',
  ...(r.reports !== undefined ? { reports: Array.isArray(r.reports) ? r.reports : [] } : {}),
  images: Array.isArray(r.images) ? r.images : [],
  createdByUsername: r.created_by_username || '',
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
})

export const campToDb = (c: any) => ({
  id: typeof c.id === 'number' && c.id < 2147483647 ? c.id : undefined,
  name: c.name || '',
  location: c.location || '',
  country: c.country || '',
  state: c.state || '',
  hotel: c.hotel || '',
  arrival_date: c.arrivalDate || '',
  departure_date: c.departureDate || '',
  start_date: c.startDate || '',
  end_date: c.endDate || '',
  team_category: c.teamCategory || '',
  program: Array.isArray(c.program) ? c.program : [],
  players: Array.isArray(c.players) ? c.players : [],
  staff: Array.isArray(c.staff) ? c.staff : [],
  staff_roles: Array.isArray(c.staffRoles) ? c.staffRoles : [],
  report_url: c.reportUrl || '',
  report_name: c.reportName || '',
  ...(c.reports !== undefined ? { reports: Array.isArray(c.reports) ? c.reports : [] } : {}),
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

// A medical report can be corrected after it has been written — including once
// the player is marked recovered. Only the report's own fields change; who
// logged it and when it was created stay untouched.
export async function updateInjury(injuryId: number, payload: {
  injury_type?: string; body_part?: string | null; severity?: string
  occurred_on?: string | null; expected_return?: string | null; notes?: string | null
}) {
  const { error } = await supabase.from('injuries').update({
    ...payload, updated_at: new Date().toISOString(),
  }).eq('id', injuryId)
  return { error: error?.message || null }
}

// ─────────────────────────────────────────────
// MEDICAL FILES (IRM images and PDF reports attached to a player card)
// The file itself lives in the private storage bucket under medical/<member>/;
// the row here remembers who uploaded what, when. Reading follows the same
// rule as injuries: medical staff, or the player's own files.
// ─────────────────────────────────────────────
export async function fetchMedicalFiles(memberId: number) {
  const { data, error } = await supabase
    .from('medical_files')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchMedicalFiles', error); return [] }
  return data
}

export async function addMedicalFile(memberId: number, filePath: string, fileName: string, fileType: 'image' | 'pdf') {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  let username: string | null = null
  if (uid) {
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
    username = profile?.username || null
  }
  const { error } = await supabase.from('medical_files').insert({
    member_id: memberId, file_path: filePath, file_name: fileName,
    file_type: fileType, uploaded_by: uid, uploaded_by_username: username,
  })
  return { error: errorMessage(error) }
}

// Deleting means both halves: the file in the bucket and the note about it.
// The storage removal is attempted even if the row is the one that would fail,
// so an orphan row never keeps a file alive on disk.
export async function deleteMedicalFile(filePath: string) {
  const { error: storageError } = await supabase.storage.from('members').remove([filePath])
  const { error } = await supabase.from('medical_files').delete().eq('file_path', filePath)
  return { error: errorMessage(storageError || error) }
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
  return { error: errorMessage(error) }
}

// PostgREST errors are plain objects: concatenating one into an alert shows
// "[object Object]" and hides the reason. Pull the message out, or serialize
// the whole thing so failures always name their cause.
function errorMessage(error: unknown): string | null {
  if (!error) return null
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  const e = error as { message?: string; hint?: string; details?: string }
  try {
    return [e.message, e.hint, e.details].filter(Boolean).join(" · ") || JSON.stringify(error)
  } catch {
    return String(error)
  }
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
  return { error: errorMessage(error) }
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
  // Signed out: there is no public roster. (squad_public was closed to anonymous
  // reads in migration 0013 - it exposed every player's details without a login.)
  return []
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

/** Save one camp straight to the database and report any error (the background sync hides them). */
export async function saveCampRow(c: any, isNew: boolean): Promise<{ error: string | null }> {
  const { id, ...rest } = campToDb(c)
  if (isNew) {
    const { error } = await supabase.from('camps').insert(rest)
    return { error: error ? error.message : null }
  }
  const { data, error } = await supabase.from('camps').update(rest).eq('id', c.id).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'No row was updated (you may not have permission to edit camps)' }
  return { error: null }
}

export async function deleteCampRow(id: number): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from('camps').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Nothing was deleted (you may not have permission)' }
  return { error: null }
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
  onClubReports?: () => void
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
    // A player submitting (or staff verifying) a club-match report — drives
    // the "new club report to review" notification for staff who can see them.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'club_match_reports' }, () => handlers.onClubReports?.())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

// ── Travel documents + trip logistics ────────────────────────────────────
// RLS decides who can read/write these (see migrations/0010). A caller without
// access simply gets empty results, never someone else's data.
export type TripEvent = 'camp' | 'match'

export async function fetchPassportExpiries(): Promise<Record<number, string>> {
  const { data, error } = await supabase.from('member_documents').select('member_id, passport_expiry')
  if (error) { console.error('fetchPassportExpiries', error); return {} }
  const out: Record<number, string> = {}
  for (const r of data || []) if (r.passport_expiry) out[Number(r.member_id)] = r.passport_expiry as string
  return out
}

export async function savePassportExpiry(memberId: number, expiry: string | null) {
  const { error } = await supabase.from('member_documents')
    .upsert({ member_id: memberId, passport_expiry: expiry || null, updated_at: new Date().toISOString() }, { onConflict: 'member_id' })
  return { error: error?.message || null }
}

export interface TripPlan {
  depart_date: string | null; depart_from: string; arrive_to: string; flight_info: string
  return_date: string | null; return_info: string
  hotel_name: string; hotel_address: string; check_in: string | null; check_out: string | null; notes: string
}
export const EMPTY_TRIP_PLAN: TripPlan = {
  depart_date: null, depart_from: '', arrive_to: '', flight_info: '', return_date: null, return_info: '',
  hotel_name: '', hotel_address: '', check_in: null, check_out: null, notes: '',
}

export async function fetchTripPlan(type: TripEvent, eventId: number): Promise<TripPlan | null> {
  const { data, error } = await supabase.from('trip_plans').select('*').eq('event_type', type).eq('event_id', eventId).maybeSingle()
  if (error) { console.error('fetchTripPlan', error); return null }
  return data ? { ...EMPTY_TRIP_PLAN, ...data } : null
}

export async function saveTripPlan(type: TripEvent, eventId: number, plan: TripPlan) {
  const row = { ...plan, event_type: type, event_id: eventId, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('trip_plans').upsert(row, { onConflict: 'event_type,event_id' })
  return { error: error?.message || null }
}

export type VisaStatus = 'unknown' | 'not_needed' | 'to_apply' | 'applied' | 'approved' | 'refused'
export type TicketStatus = 'pending' | 'booked'
export interface TripMember { member_id: number; visa_status: VisaStatus; ticket_status: TicketStatus; room: string; notes: string }

export async function fetchTripMembers(type: TripEvent, eventId: number): Promise<TripMember[]> {
  const { data, error } = await supabase.from('trip_members').select('member_id, visa_status, ticket_status, room, notes')
    .eq('event_type', type).eq('event_id', eventId)
  if (error) { console.error('fetchTripMembers', error); return [] }
  return (data || []).map(r => ({ ...r, member_id: Number(r.member_id) })) as TripMember[]
}

export async function saveTripMember(type: TripEvent, eventId: number, m: TripMember) {
  const row = { ...m, event_type: type, event_id: eventId, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('trip_members').upsert(row, { onConflict: 'event_type,event_id,member_id' })
  return { error: error?.message || null }
}

// "Download my data": everything the database holds about the signed-in person,
// gathered with their OWN session, so row-level security guarantees it can only
// ever contain their own rows. Image/document files are listed by path, not embedded.
export async function exportMyData() {
  const profile = await fetchMyProfile()
  if (!profile) return null
  const mid = profile.member_id as number | null
  const { calendar_token: _omit, ...profileSafe } = profile as any
  const out: Record<string, any> = { exportedAt: new Date().toISOString(), account: profileSafe }
  if (mid != null) {
    const [member, injuries, reports, docs, trips] = await Promise.all([
      supabase.from('members').select('*').eq('id', mid).maybeSingle(),
      supabase.from('injuries').select('*').eq('member_id', mid),
      supabase.from('club_match_reports').select('*').eq('member_id', mid),
      supabase.from('member_documents').select('*').eq('member_id', mid),
      supabase.from('trip_members').select('*').eq('member_id', mid),
    ])
    out.rosterCard = member.data || null
    out.injuries = injuries.data || []
    out.clubMatchReports = reports.data || []
    out.travelDocuments = docs.data || []
    out.tripDetails = trips.data || []
  }
  return out
}


// ─────────────────────────────────────────────
// LIGUE FEMININE (club teams)
// ─────────────────────────────────────────────
export interface LeagueTeam { id: number; name: string; logoPath: string | null }

/** Admin sees every club, a club account sees only its own (RLS). Empty before migration 0012. */
export async function fetchLeagueTeams(): Promise<LeagueTeam[]> {
  const { data, error } = await supabase.from('league_teams').select('id,name,logo_path').order('name')
  if (error) return []
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, logoPath: r.logo_path ?? null }))
}

async function leagueTeamsCall(method: 'POST' | 'DELETE', body: unknown): Promise<{ error: string | null; id?: number }> {
  try {
    const res = await fetch('/api/league-teams', {
      method,
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: typeof json?.error === 'string' ? json.error : 'Request failed' }
    return { error: null, id: json?.id }
  } catch {
    return { error: 'Network error' }
  }
}

/** Admin only: creates the club, its logo reference and its login in one go. */
export const createLeagueTeam = (p: { name: string; username: string; password: string; logoPath: string | null }) =>
  leagueTeamsCall('POST', p)

/** Admin only: refused by the server while the club still has players. */
export const deleteLeagueTeam = (id: number) => leagueTeamsCall('DELETE', { id })

/** Admin only: gives an existing club that has no login a username and password. */
export const createClubLogin = (p: { teamId: number; username: string; password: string }) =>
  leagueTeamsCall('POST', p)

/** Admin only (RLS): which club already has a login, as teamId -> username. */
export async function fetchClubLogins(): Promise<Record<number, string>> {
  const { data, error } = await supabase.from('profiles').select('username,league_team_id').eq('role', 'club')
  if (error) return {}
  const out: Record<number, string> = {}
  for (const r of data ?? []) if (r.league_team_id != null) out[r.league_team_id] = r.username
  return out
}

// ─────────────────────────────────────────────
// LIGUE FEMININE: seasons, matchdays, results (migration 0014)
// ─────────────────────────────────────────────
export interface LeagueSeason { id: number; name: string; startsOn: string | null; endsOn: string | null; isCurrent: boolean; cupName: string | null; cupInfo: string | null }
export type FixtureStatus = 'scheduled' | 'played' | 'postponed'
export interface LeagueFixture {
  id: number; seasonId: number; matchday: number; homeTeamId: number; awayTeamId: number
  /** ISO timestamp, or null while the date is not fixed. */
  kickoff: string | null; venue: string | null; status: FixtureStatus
  homeGoals: number | null; awayGoals: number | null
}
/** Why a fixtures write failed, so the screen can say it in the user's language. */
export type FixtureError = 'duplicate' | 'sameTeam' | 'invalid' | 'denied' | 'generic'

const fixtureError = (e: { code?: string; message?: string } | null): FixtureError | null => {
  if (!e) return null
  if (e.code === '23505') return 'duplicate'
  if (e.code === '23514') return /league_(fixtures|cup_matches)_check"/.test(e.message ?? '') ? 'sameTeam' : 'invalid'
  if (e.code === '42501') return 'denied'
  return 'generic'
}

/** Every club's id, name and logo. A club account needs this to name its opponents. */
export async function fetchLeagueDirectory(): Promise<LeagueTeam[]> {
  const { data, error } = await supabase.rpc('league_club_directory')
  if (error) return []
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, logoPath: r.logo_path ?? null }))
}

export async function fetchLeagueSeasons(): Promise<LeagueSeason[]> {
  const { data, error } = await supabase.from('league_seasons').select('id,name,starts_on,ends_on,is_current,cup_name,cup_info').order('starts_on', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  if (error) return []
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, startsOn: r.starts_on ?? null, endsOn: r.ends_on ?? null, isCurrent: !!r.is_current, cupName: r.cup_name ?? null, cupInfo: r.cup_info ?? null }))
}

export async function fetchLeagueFixtures(seasonId: number): Promise<LeagueFixture[]> {
  const { data, error } = await supabase.from('league_fixtures')
    .select('id,season_id,matchday,home_team_id,away_team_id,kickoff,venue,status,home_goals,away_goals')
    .eq('season_id', seasonId).order('matchday').order('kickoff', { nullsFirst: false }).order('id')
  if (error) return []
  return (data ?? []).map((r: any) => ({
    id: r.id, seasonId: r.season_id, matchday: r.matchday, homeTeamId: r.home_team_id, awayTeamId: r.away_team_id,
    kickoff: r.kickoff ?? null, venue: r.venue ?? null, status: r.status, homeGoals: r.home_goals ?? null, awayGoals: r.away_goals ?? null,
  }))
}

// ── Player statistics (migration 0018) ──────────────────────────────────────

export interface LeaguePlayerStat {
  memberId: number
  name: string
  teamId: number | null
  teamName: string | null
  appearances: number
  goals: number
  assists: number
  yellows: number
  reds: number
}

/** One player's season line, as stored. teamId/teamName are not part of the table. */
export interface LeaguePlayerStatRow {
  seasonId: number
  memberId: number
  appearances: number
  goals: number
  assists: number
  yellows: number
  reds: number
}

/**
 * Every player's line for a season, with the name and club joined on.
 * The RPC is SECURITY INVOKER, so the table's own policies decide what the
 * caller may see: an admin or a club account, nobody else.
 */
export async function fetchLeaguePlayerStats(seasonId: number): Promise<LeaguePlayerStat[]> {
  const { data, error } = await supabase.rpc('league_top_players', { p_season_id: seasonId })
  if (error || !data) return []
  return (data as any[]).map((r) => ({
    memberId: Number(r.member_id),
    name: r.name ?? '',
    teamId: r.team_id != null ? Number(r.team_id) : null,
    teamName: r.team_name ?? null,
    appearances: Number(r.appearances || 0),
    goals: Number(r.goals || 0),
    assists: Number(r.assists || 0),
    yellows: Number(r.yellows || 0),
    reds: Number(r.reds || 0),
  }))
}

/**
 * Save one player's line. Upserts on (season_id, member_id), so entering a
 * stat twice corrects it rather than failing. Admin only (RLS).
 */
export async function saveLeaguePlayerStat(
  row: LeaguePlayerStatRow,
): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_player_stats').upsert(
    {
      season_id: row.seasonId,
      member_id: row.memberId,
      appearances: row.appearances,
      goals: row.goals,
      assists: row.assists,
      yellows: row.yellows,
      reds: row.reds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'season_id,member_id' },
  )
  return { error: fixtureError(error) }
}

/** Admin only (RLS). Drops a player's line entirely. */
export async function deleteLeaguePlayerStat(
  seasonId: number,
  memberId: number,
): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_player_stats')
    .delete().eq('season_id', seasonId).eq('member_id', memberId)
  return { error: fixtureError(error) }
}

/** Admin only (RLS). The first season ever created becomes the current one. */
export async function createLeagueSeason(p: { name: string; startsOn: string | null; endsOn: string | null; makeCurrent: boolean }): Promise<{ error: FixtureError | null; id?: number }> {
  const { data, error } = await supabase.from('league_seasons').insert({ name: p.name.trim(), starts_on: p.startsOn || null, ends_on: p.endsOn || null }).select('id').single()
  if (error) return { error: fixtureError(error) }
  if (p.makeCurrent) await supabase.rpc('league_set_current_season', { p_id: data.id })
  return { error: null, id: data.id }
}

export async function setCurrentLeagueSeason(id: number): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.rpc('league_set_current_season', { p_id: id })
  return { error: fixtureError(error) }
}

/** Deletes the season and, by cascade, all of its fixtures. */
export async function deleteLeagueSeason(id: number): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_seasons').delete().eq('id', id)
  return { error: fixtureError(error) }
}

/** Insert (no id) or update (id) one match. Scores only count when status is "played". */
export async function saveLeagueFixture(f: Omit<LeagueFixture, 'id'> & { id?: number; changeNote?: string | null }): Promise<{ error: FixtureError | null }> {
  const played = f.status === 'played'
  const row = {
    season_id: f.seasonId, matchday: f.matchday, home_team_id: f.homeTeamId, away_team_id: f.awayTeamId,
    kickoff: f.kickoff, venue: f.venue?.trim() || null, status: f.status,
    home_goals: played ? f.homeGoals : null, away_goals: played ? f.awayGoals : null,
  } as Record<string, unknown>
  // The column comes with migration 0023, whose trigger clears it after use; only sent when there is a reason,
  // so saving a match keeps working before 0023 is applied.
  if (f.changeNote?.trim()) row.change_note = f.changeNote.trim()
  const { error } = f.id ? await supabase.from('league_fixtures').update(row).eq('id', f.id) : await supabase.from('league_fixtures').insert(row)
  return { error: fixtureError(error) }
}

export async function deleteLeagueFixture(id: number): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_fixtures').delete().eq('id', id)
  return { error: fixtureError(error) }
}

/** Admin only: inserts many generated matches at once (chunked so no single request is huge). */
export async function bulkCreateLeagueFixtures(rows: { seasonId: number; matchday: number; homeTeamId: number; awayTeamId: number; kickoff: string | null; venue?: string | null }[]): Promise<{ error: FixtureError | null }> {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100).map(r => ({
      season_id: r.seasonId, matchday: r.matchday, home_team_id: r.homeTeamId, away_team_id: r.awayTeamId,
      kickoff: r.kickoff, venue: r.venue ?? null, status: 'scheduled', home_goals: null, away_goals: null,
    }))
    const { error } = await supabase.from('league_fixtures').insert(chunk)
    if (error) return { error: fixtureError(error) }
  }
  return { error: null }
}

/** Delete every fixture of a season (used before importing the official calendar). */
export async function deleteSeasonFixtures(seasonId: number): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_fixtures').delete().eq('season_id', seasonId)
  return { error: error ? fixtureError(error) : null }
}

// ── cup (migration 0015) ──
/** Number of clubs left in the round: 2 = final, 4 = semi-finals, 8 = quarter-finals, 16, 32, 64. */
export type CupRound = 2 | 4 | 8 | 16 | 32 | 64
export interface LeagueCupMatch {
  id: number; seasonId: number; round: CupRound; slot: number
  homeTeamId: number | null; awayTeamId: number | null
  kickoff: string | null; venue: string | null; status: FixtureStatus
  homeGoals: number | null; awayGoals: number | null; homePens: number | null; awayPens: number | null
}

export async function fetchLeagueCupMatches(seasonId: number): Promise<LeagueCupMatch[]> {
  const { data, error } = await supabase.from('league_cup_matches')
    .select('id,season_id,round,slot,home_team_id,away_team_id,kickoff,venue,status,home_goals,away_goals,home_pens,away_pens')
    .eq('season_id', seasonId).order('round', { ascending: false }).order('slot')
  if (error) return []
  return (data ?? []).map((r: any) => ({
    id: r.id, seasonId: r.season_id, round: r.round, slot: r.slot, homeTeamId: r.home_team_id ?? null, awayTeamId: r.away_team_id ?? null,
    kickoff: r.kickoff ?? null, venue: r.venue ?? null, status: r.status,
    homeGoals: r.home_goals ?? null, awayGoals: r.away_goals ?? null, homePens: r.home_pens ?? null, awayPens: r.away_pens ?? null,
  }))
}

export async function saveLeagueCupMatch(m: Omit<LeagueCupMatch, 'id'> & { id?: number }): Promise<{ error: FixtureError | null }> {
  const played = m.status === 'played'
  const tied = played && m.homeGoals != null && m.homeGoals === m.awayGoals
  const row = {
    season_id: m.seasonId, round: m.round, slot: m.slot, home_team_id: m.homeTeamId, away_team_id: m.awayTeamId,
    kickoff: m.kickoff, venue: m.venue?.trim() || null, status: m.status,
    home_goals: played ? m.homeGoals : null, away_goals: played ? m.awayGoals : null,
    home_pens: tied ? m.homePens : null, away_pens: tied ? m.awayPens : null,
  }
  const { error } = m.id ? await supabase.from('league_cup_matches').update(row).eq('id', m.id) : await supabase.from('league_cup_matches').insert(row)
  return { error: fixtureError(error) }
}

export async function deleteLeagueCupMatch(id: number): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_cup_matches').delete().eq('id', id)
  return { error: fixtureError(error) }
}

/** Admin only: the cup's name and description for a season. */
export async function saveLeagueCupInfo(seasonId: number, cupName: string, cupInfo: string): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_seasons').update({ cup_name: cupName.trim() || null, cup_info: cupInfo.trim() || null }).eq('id', seasonId)
  return { error: fixtureError(error) }
}

// ── season breaks (migration 0015) ──
export interface LeagueBreak { id: number; seasonId: number; title: string; startsOn: string; endsOn: string }

export async function fetchLeagueBreaks(seasonId: number): Promise<LeagueBreak[]> {
  const { data, error } = await supabase.from('league_breaks').select('id,season_id,title,starts_on,ends_on').eq('season_id', seasonId).order('starts_on')
  if (error) return []
  return (data ?? []).map((r: any) => ({ id: r.id, seasonId: r.season_id, title: r.title, startsOn: r.starts_on, endsOn: r.ends_on }))
}

export async function createLeagueBreak(p: { seasonId: number; title: string; startsOn: string; endsOn: string }): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_breaks').insert({ season_id: p.seasonId, title: p.title.trim(), starts_on: p.startsOn, ends_on: p.endsOn })
  return { error: fixtureError(error) }
}

export async function deleteLeagueBreak(id: number): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_breaks').delete().eq('id', id)
  return { error: fixtureError(error) }
}

// ── match sheet (migration 0020) ──
export type EventKind = 'goal' | 'assist' | 'yellow' | 'red'
export interface LeagueMatchEvent { id: number; fixtureId: number; seasonId: number; teamId: number; memberId: number; playerName: string; kind: EventKind; minute: number | null }
export interface LeagueLineupEntry { id: number; fixtureId: number; seasonId: number; teamId: number; memberId: number; playerName: string }
export interface LeagueRosterEntry { id: number; name: string; teamId: number }

export async function fetchLeagueEvents(seasonId: number): Promise<LeagueMatchEvent[]> {
  const { data, error } = await supabase.from('league_match_events').select('id,fixture_id,season_id,team_id,member_id,player_name,kind,minute').eq('season_id', seasonId).order('minute', { ascending: true, nullsFirst: false })
  if (error || !data) return []
  return data.map((r: any) => ({ id: r.id, fixtureId: r.fixture_id, seasonId: r.season_id, teamId: r.team_id, memberId: r.member_id, playerName: r.player_name, kind: r.kind, minute: r.minute }))
}
export async function fetchLeagueLineups(seasonId: number): Promise<LeagueLineupEntry[]> {
  const { data, error } = await supabase.from('league_match_lineup').select('id,fixture_id,season_id,team_id,member_id,player_name').eq('season_id', seasonId)
  if (error || !data) return []
  return data.map((r: any) => ({ id: r.id, fixtureId: r.fixture_id, seasonId: r.season_id, teamId: r.team_id, memberId: r.member_id, playerName: r.player_name }))
}
/** Admin only: the players of the given clubs (names for the match sheet pickers). */
export async function fetchLeagueRoster(teamIds: number[]): Promise<LeagueRosterEntry[]> {
  if (!teamIds.length) return []
  const { data, error } = await supabase.from('members').select('id,name,league_team_id').in('league_team_id', teamIds).order('name')
  if (error || !data) return []
  return data.map((r: any) => ({ id: r.id, name: r.name, teamId: r.league_team_id }))
}
export async function addLeagueEvent(e: { fixtureId: number; teamId: number; memberId: number; kind: EventKind; minute: number | null }): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_match_events').insert({ fixture_id: e.fixtureId, team_id: e.teamId, member_id: e.memberId, kind: e.kind, minute: e.minute })
  return { error: fixtureError(error) }
}
export async function deleteLeagueEvent(id: number): Promise<{ error: FixtureError | null }> {
  const { error } = await supabase.from('league_match_events').delete().eq('id', id)
  return { error: fixtureError(error) }
}
/** Replace one club's lineup for a match. */
export async function setLeagueLineup(fixtureId: number, teamId: number, memberIds: number[]): Promise<{ error: FixtureError | null }> {
  const del = await supabase.from('league_match_lineup').delete().eq('fixture_id', fixtureId).eq('team_id', teamId)
  if (del.error) return { error: fixtureError(del.error) }
  if (!memberIds.length) return { error: null }
  const { error } = await supabase.from('league_match_lineup').insert(memberIds.map(m => ({ fixture_id: fixtureId, team_id: teamId, member_id: m })))
  return { error: fixtureError(error) }
}

// ── history, notifications, squads (migration 0021) ──
export interface LeagueFixtureChange { id: number; fixtureId: number; oldKickoff: string | null; newKickoff: string | null; oldStatus: FixtureStatus; newStatus: FixtureStatus; note: string | null; changedAt: string }
export interface LeagueNotification { id: number; teamId: number; fixtureId: number; kind: 'scheduled' | 'moved' | 'postponed' | 'result'; createdAt: string; readAt: string | null }
export interface LeagueSquadEntry { id: number; fixtureId: number; teamId: number; memberId: number; playerName: string }

export async function fetchLeagueChanges(seasonId: number): Promise<LeagueFixtureChange[]> {
  const { data, error } = await supabase.from('league_fixture_changes').select('id,fixture_id,old_kickoff,new_kickoff,old_status,new_status,note,changed_at').eq('season_id', seasonId).order('changed_at')
  if (error || !data) return []
  return data.map((r: any) => ({ id: r.id, fixtureId: r.fixture_id, oldKickoff: r.old_kickoff, newKickoff: r.new_kickoff, oldStatus: r.old_status, newStatus: r.new_status, note: r.note, changedAt: r.changed_at }))
}
export async function fetchMyNotifications(): Promise<LeagueNotification[]> {
  const { data, error } = await supabase.from('league_notifications').select('id,team_id,fixture_id,kind,created_at,read_at').order('created_at', { ascending: false }).limit(30)
  if (error || !data) return []
  return data.map((r: any) => ({ id: r.id, teamId: r.team_id, fixtureId: r.fixture_id, kind: r.kind, createdAt: r.created_at, readAt: r.read_at }))
}
export async function markNotificationsRead(ids: number[]): Promise<void> {
  if (!ids.length) return
  await supabase.from('league_notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
}
export async function fetchLeagueSquads(seasonId: number): Promise<LeagueSquadEntry[]> {
  const { data, error } = await supabase.from('league_match_squad').select('id,fixture_id,team_id,member_id,player_name').eq('season_id', seasonId)
  if (error || !data) return []
  return data.map((r: any) => ({ id: r.id, fixtureId: r.fixture_id, teamId: r.team_id, memberId: r.member_id, playerName: r.player_name }))
}
/** Replace one club's squad for a match (a club account can only do this for its own club, until the match is played). */
export async function setMatchSquad(fixtureId: number, teamId: number, memberIds: number[]): Promise<{ error: FixtureError | null }> {
  const del = await supabase.from('league_match_squad').delete().eq('fixture_id', fixtureId).eq('team_id', teamId)
  if (del.error) return { error: fixtureError(del.error) }
  if (!memberIds.length) return { error: null }
  const { error } = await supabase.from('league_match_squad').insert(memberIds.map(m => ({ fixture_id: fixtureId, team_id: teamId, member_id: m })))
  return { error: fixtureError(error) }
}
