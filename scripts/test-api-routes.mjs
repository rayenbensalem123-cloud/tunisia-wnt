// Lightweight route-handler tests for the file-upload/parsing API routes.
// No running server, no live Supabase project: each route's POST() export is
// called directly against a hand-built Request, following the style of
// scripts/test-callups.mjs.
//
// Run with:  node --import ./scripts/register-alias-loader.mjs scripts/test-api-routes.mjs
//   (the alias loader resolves this repo's "@/..." tsconfig path alias, the
//   same way Next.js does at build time, since plain `node` cannot).
//
// Auth: lib/api-auth.ts's requireActiveUser() calls Supabase over HTTP
// (auth.getUser + a profiles select). For the "no Authorization header"
// case this never happens (requireActiveUser returns 401 before any
// network call), so that case is tested with zero mocking. For the
// "authenticated but bad input" cases (wrong file type, oversized file) we
// stub the global fetch Supabase's client uses, so the auth check is
// satisfied deterministically without a live project. This is a full,
// deterministic stub, not a live network call, so it can't be flaky.

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key'

import assert from 'node:assert/strict'

let n = 0
let failed = 0
const t = async (name, fn) => {
  try {
    await fn()
    n++
    console.log(`ok - ${name}`)
  } catch (e) {
    failed++
    console.error(`FAIL - ${name}`)
    console.error(e)
  }
}

// --- Fetch stub -------------------------------------------------------
// Installed only for the duration of tests that need a satisfied auth
// check. Intercepts Supabase GoTrue's /auth/v1/user and PostgREST's
// /rest/v1/profiles calls; everything else falls through to the real fetch
// (there shouldn't be anything else reachable before our assertions fire).
const realFetch = globalThis.fetch
function installAuthStub({ activeProfile = true, permissions = { addPlayer: true }, role = 'staff', leagueTeamId = null } = {}) {
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'test-user-id', email: 'test@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.includes('/rest/v1/profiles')) {
      const profile = {
        id: 'test-user-id',
        username: 'tester',
        role,
        status: activeProfile ? 'active' : 'suspended',
        permissions,
        league_team_id: leagueTeamId,
      }
      return new Response(JSON.stringify(profile), {
        status: 200,
        headers: { 'content-type': 'application/vnd.pgrst.object+json' },
      })
    }
    if (url.includes('/storage/v1/object/members/')) {
      return new Response(JSON.stringify({ Key: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new Error(`Unexpected fetch in test stub: ${url}`)
  }
}
function restoreFetch() {
  globalThis.fetch = realFetch
}

function fakeFile(name, type, sizeBytes) {
  const bytes = new Uint8Array(sizeBytes)
  return new File([bytes], name, { type })
}

async function run() {
  const { POST: uploadPOST } = await import('../app/api/upload/route.ts')
  const { POST: importPlayersPOST } = await import('../app/api/import-players/route.ts')
  const { POST: parseCallupsPOST } = await import('../app/api/parse-callups/route.ts')
  const { POST: parseCvPOST } = await import('../app/api/parse-cv/route.ts')
  const { POST: leaguePOST, DELETE: leagueDELETE } = await import('../app/api/league-teams/route.ts')

  // --- /api/upload ------------------------------------------------------
  await t('upload: no Authorization header -> 401', async () => {
    const req = new Request('http://localhost/api/upload', { method: 'POST', body: new FormData() })
    const res = await uploadPOST(req)
    assert.equal(res.status, 401)
  })

  await t('upload: unsupported file type -> 415', async () => {
    installAuthStub()
    try {
      const form = new FormData()
      form.set('file', fakeFile('virus.exe', 'application/x-msdownload', 10))
      const req = new Request('http://localhost/api/upload', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: form,
      })
      const res = await uploadPOST(req)
      assert.equal(res.status, 415)
    } finally {
      restoreFetch()
    }
  })

  await t('upload: oversized file -> 413', async () => {
    installAuthStub()
    try {
      const big = fakeFile('photo.jpg', 'image/jpeg', 6 * 1024 * 1024) // > 5 MB MAX_BYTES
      const form = new FormData()
      form.set('file', big)
      const req = new Request('http://localhost/api/upload', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-length': String(big.size) },
        body: form,
      })
      const res = await uploadPOST(req)
      assert.equal(res.status, 413)
    } finally {
      restoreFetch()
    }
  })

  // --- /api/import-players -----------------------------------------------
  await t('import-players: no Authorization header -> 401', async () => {
    const req = new Request('http://localhost/api/import-players', { method: 'POST', body: new FormData() })
    const res = await importPlayersPOST(req)
    assert.equal(res.status, 401)
  })

  await t('import-players: non-PDF file -> 415', async () => {
    installAuthStub()
    try {
      const form = new FormData()
      form.set('file', fakeFile('roster.txt', 'text/plain', 10))
      const req = new Request('http://localhost/api/import-players', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: form,
      })
      const res = await importPlayersPOST(req)
      assert.equal(res.status, 415)
    } finally {
      restoreFetch()
    }
  })

  await t('import-players: oversized file -> 413', async () => {
    installAuthStub()
    try {
      const big = fakeFile('roster.pdf', 'application/pdf', 9 * 1024 * 1024) // > 8 MB MAX_BYTES
      const form = new FormData()
      form.set('file', big)
      const req = new Request('http://localhost/api/import-players', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-length': String(big.size) },
        body: form,
      })
      const res = await importPlayersPOST(req)
      assert.equal(res.status, 413)
    } finally {
      restoreFetch()
    }
  })

  // --- /api/parse-callups --------------------------------------------------
  await t('parse-callups: no Authorization header -> 401', async () => {
    const req = new Request('http://localhost/api/parse-callups', { method: 'POST', body: new FormData() })
    const res = await parseCallupsPOST(req)
    assert.equal(res.status, 401)
  })

  await t('parse-callups: non-PDF file -> 415', async () => {
    installAuthStub({ permissions: { addCamps: true } })
    try {
      const form = new FormData()
      form.set('file', fakeFile('callups.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 10))
      const req = new Request('http://localhost/api/parse-callups', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: form,
      })
      const res = await parseCallupsPOST(req)
      assert.equal(res.status, 415)
    } finally {
      restoreFetch()
    }
  })

  await t('parse-callups: oversized file -> 413', async () => {
    installAuthStub({ permissions: { addCamps: true } })
    try {
      const big = fakeFile('callups.pdf', 'application/pdf', 9 * 1024 * 1024) // > 8 MB MAX_BYTES
      const form = new FormData()
      form.set('file', big)
      const req = new Request('http://localhost/api/parse-callups', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-length': String(big.size) },
        body: form,
      })
      const res = await parseCallupsPOST(req)
      assert.equal(res.status, 413)
    } finally {
      restoreFetch()
    }
  })

  // --- /api/parse-cv ----------------------------------------------------
  const cvReq = (file, extra = {}) => {
    const form = new FormData()
    if (file) form.set('file', file)
    return new Request('http://localhost/api/parse-cv', { method: 'POST', headers: { authorization: 'Bearer test-token', ...extra }, body: form })
  }
  const pdfFile = (extraBytes = 20) => new File([new TextEncoder().encode('%PDF-1.4 ' + 'x'.repeat(extraBytes))], 'cv.pdf', { type: 'application/pdf' })

  await t('parse-cv: no Authorization header -> 401', async () => {
    const res = await parseCvPOST(new Request('http://localhost/api/parse-cv', { method: 'POST', body: new FormData() }))
    assert.equal(res.status, 401)
  })

  await t('parse-cv: no addPlayer/editPlayer permission -> 403', async () => {
    installAuthStub({ permissions: { addCamps: true } })
    try { assert.equal((await parseCvPOST(cvReq(pdfFile()))).status, 403) } finally { restoreFetch() }
  })

  await t('parse-cv: AI key not configured -> 503', async () => {
    installAuthStub()
    delete process.env.ANTHROPIC_API_KEY
    try {
      const res = await parseCvPOST(cvReq(pdfFile()))
      assert.equal(res.status, 503)
      assert.equal((await res.json()).code, 'not_configured')
    } finally { restoreFetch() }
  })

  await t('parse-cv: not a PDF/image (by content, not name) -> 415', async () => {
    installAuthStub()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    try {
      const fake = new File([new TextEncoder().encode('MZ this is an exe renamed cv.pdf')], 'cv.pdf', { type: 'application/pdf' })
      assert.equal((await parseCvPOST(cvReq(fake))).status, 415)
    } finally { restoreFetch() }
  })

  await t('parse-cv: oversized file -> 413', async () => {
    installAuthStub()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    try {
      const big = new File([new Uint8Array(9 * 1024 * 1024)], 'cv.pdf', { type: 'application/pdf' })
      assert.equal((await parseCvPOST(cvReq(big, { 'content-length': String(big.size) }))).status, 413)
    } finally { restoreFetch() }
  })

  await t('parse-cv: success returns only sanitized, mapped fields', async () => {
    installAuthStub()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const supa = globalThis.fetch
    let sentBody = null
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.startsWith('https://api.anthropic.com/v1/messages')) {
        sentBody = JSON.parse(init.body)
        assert.equal(init.headers['x-api-key'], 'test-key')
        return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'record_profile', input: {
          name: 'Sara Test', position: 'Right Winger', birthdate: '2004-11-02', heightCm: 168, isAdmin: true,
          career: [{ years: '2019-2021', team: 'Club A' }],
        } }] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return supa(input, init)
    }
    try {
      const res = await parseCvPOST(cvReq(pdfFile()))
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.deepEqual(body.fields, { name: 'Sara Test', position: 'FORWARD', birthdate: '02/11/2004', height: '168' })
      assert.deepEqual(body.history, [{ year: '2019-2021', event: 'Club A' }])
      assert.equal(sentBody.tool_choice.name, 'record_profile')
      assert.equal(sentBody.messages[0].content[0].source.media_type, 'application/pdf')
    } finally { restoreFetch(); delete process.env.ANTHROPIC_API_KEY }
  })

  await t('parse-cv: upstream failure -> 502 without leaking details', async () => {
    installAuthStub()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const supa = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.startsWith('https://api.anthropic.com')) return new Response('{"error":"secret detail"}', { status: 500 })
      return supa(input, init)
    }
    try {
      const res = await parseCvPOST(cvReq(pdfFile()))
      assert.equal(res.status, 502)
      assert.ok(!JSON.stringify(await res.json()).includes('secret'))
    } finally { restoreFetch(); delete process.env.ANTHROPIC_API_KEY }
  })

  // --- /api/league-teams + league uploads ------------------------------------
  const leagueReq = (method, body) => new Request('http://localhost/api/league-teams', { method, headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const leagueUpload = (extra = {}, type = 'image/png') => {
    const form = new FormData()
    form.set('file', new File([new Uint8Array(20)], 'p.png', { type }))
    form.set('folder', 'league')
    for (const [k, v] of Object.entries(extra)) form.set(k, v)
    return new Request('http://localhost/api/upload', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: form })
  }

  await t('league-teams: no Authorization header -> 401', async () => {
    assert.equal((await leaguePOST(new Request('http://localhost/api/league-teams', { method: 'POST', body: '{}' }))).status, 401)
  })
  await t('league-teams: staff cannot create a team -> 403', async () => {
    installAuthStub({ role: 'staff', permissions: { addPlayer: true } })
    try { assert.equal((await leaguePOST(leagueReq('POST', { name: 'ASF', username: 'asf', password: 'secret1' }))).status, 403) } finally { restoreFetch() }
  })
  await t('league-teams: a club account cannot create or delete teams -> 403', async () => {
    installAuthStub({ role: 'club', permissions: {}, leagueTeamId: 7 })
    try {
      assert.equal((await leaguePOST(leagueReq('POST', { name: 'X team', username: 'xteam', password: 'secret1' }))).status, 403)
      assert.equal((await leagueDELETE(leagueReq('DELETE', { id: 7 }))).status, 403)
    } finally { restoreFetch() }
  })
  await t('league-teams: admin input is validated before anything is created -> 400', async () => {
    installAuthStub({ role: 'admin', permissions: {} })
    try {
      assert.equal((await leaguePOST(leagueReq('POST', { name: 'A', username: 'asf', password: 'secret1' }))).status, 400)
      assert.equal((await leaguePOST(leagueReq('POST', { name: 'ASF', username: 'Bad Name!', password: 'secret1' }))).status, 400)
      assert.equal((await leaguePOST(leagueReq('POST', { name: 'ASF', username: 'asf', password: '123' }))).status, 400)
      assert.equal((await leaguePOST(leagueReq('POST', { name: 'ASF', username: 'asf', password: 'secret1', logoPath: '../../etc/passwd' }))).status, 400)
      assert.equal((await leagueDELETE(leagueReq('DELETE', { id: 'abc' }))).status, 400)
    } finally { restoreFetch() }
  })
  await t('league-teams: adding a login to an existing team validates input and is admin only', async () => {
    installAuthStub({ role: 'club', permissions: {}, leagueTeamId: 7 })
    try { assert.equal((await leaguePOST(leagueReq('POST', { teamId: 7, username: 'newlogin', password: 'secret1' }))).status, 403) } finally { restoreFetch() }
    installAuthStub({ role: 'admin', permissions: {} })
    try {
      assert.equal((await leaguePOST(leagueReq('POST', { teamId: 'abc', username: 'newlogin', password: 'secret1' }))).status, 400)
      assert.equal((await leaguePOST(leagueReq('POST', { teamId: 7, username: 'x', password: 'secret1' }))).status, 400)
      assert.equal((await leaguePOST(leagueReq('POST', { teamId: 7, username: 'newlogin', password: '123' }))).status, 400)
    } finally { restoreFetch() }
  })
  await t('upload league: a club always lands in its OWN team folder', async () => {
    installAuthStub({ role: 'club', permissions: {}, leagueTeamId: 7 })
    try {
      const res = await uploadPOST(leagueUpload({ leagueTeamId: '99' })) // a client-supplied team is ignored
      assert.equal(res.status, 200)
      assert.ok((await res.json()).path.startsWith('league/7/'))
    } finally { restoreFetch() }
  })
  await t('upload league: a club cannot upload a logo -> 403', async () => {
    installAuthStub({ role: 'club', permissions: {}, leagueTeamId: 7 })
    try { assert.equal((await uploadPOST(leagueUpload({ logo: '1' }))).status, 403) } finally { restoreFetch() }
  })
  await t('upload league: staff are refused -> 403; admin logo and player photo get the right folders', async () => {
    installAuthStub({ role: 'staff' })
    try { assert.equal((await uploadPOST(leagueUpload())).status, 403) } finally { restoreFetch() }
    installAuthStub({ role: 'admin', permissions: {} })
    try {
      assert.ok((await (await uploadPOST(leagueUpload({ logo: '1' }))).json()).path.startsWith('league/logos/'))
      assert.ok((await (await uploadPOST(leagueUpload({ leagueTeamId: '12' }))).json()).path.startsWith('league/12/'))
      assert.equal((await uploadPOST(leagueUpload())).status, 400) // no team given
    } finally { restoreFetch() }
  })
  await t('parse-cv: a club account is allowed to use CV import', async () => {
    installAuthStub({ role: 'club', permissions: {}, leagueTeamId: 7 })
    delete process.env.ANTHROPIC_API_KEY
    try { assert.equal((await parseCvPOST(cvReq(pdfFile()))).status, 503) } finally { restoreFetch() } // past the permission gate, stops at "no key"
  })

  console.log(`\n${n} tests passed${failed ? `, ${failed} FAILED` : ''}`)
  if (failed) process.exit(1)
}

run()
