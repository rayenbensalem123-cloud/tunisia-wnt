// Verify the match-sheet migration independently of the app.
//
// PostgREST tells us the two things we cannot see in the SQL:
//   * a table is there      -> 401 (exists, `anon` not granted) rather than 404
//   * a function is there   -> 401 rather than 404, PROVIDED we pass its real
//     parameter names, because a missing argument also answers 404. Passing the
//     correct names removes that ambiguity; a 404 then means genuinely absent.
//
// Safe to run: `anon` holds no EXECUTE on any of these, so the call is refused
// before it can execute. The arguments are a season that does not exist anyway.
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null
}
const url = get('NEXT_PUBLIC_SUPABASE_URL'); const key = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const auth = { apikey: key, Authorization: `Bearer ${key}` }
let failures = 0

const ok = (label, pass, detail) => {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${label}${detail ? '   ' + detail : ''}`)
  if (!pass) failures++
}

// ── tables and their columns ──
const columns = {
  league_match_lineup: ['fixture_id', 'season_id', 'team_id', 'member_id', 'player_name'],
  league_match_events: ['fixture_id', 'season_id', 'team_id', 'member_id', 'player_name', 'kind', 'minute'],
}
for (const [table, cols] of Object.entries(columns)) {
  const r = await fetch(`${url}/rest/v1/${table}?select=${cols.join(',')}&limit=0`, { headers: auth })
  const body = await r.text()
  ok(`table ${table} exists with its columns`, r.status === 401 || r.status === 200,
    r.status === 200 ? '' : `${r.status} ${body.slice(0, 90)}`)
}

// ── functions, called with their real parameter names ──
const calls = [
  ['league_recount_player', { p_season: -1, p_member: -1 }],
  ['league_recount_season', { p_season: -1 }],
  ['league_top_players', { p_season_id: -1 }],
]
for (const [fn, args] of calls) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const body = await r.text()
  // 401/403 = present but not granted to anon (what we expect).
  // 404     = absent. 200/204 = anon can execute it, which must never happen for
  // a function that writes.
  const present = r.status === 401 || r.status === 403 || r.status === 200 || r.status === 204
  ok(`function ${fn} exists`, present, `${r.status} ${body.slice(0, 80)}`)
  if (r.status === 200 || r.status === 204) ok(`  ...and is NOT open to anonymous`, false, 'anon EXECUTE is too broad')
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
