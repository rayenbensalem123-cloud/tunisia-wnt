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
function installAuthStub({ activeProfile = true, permissions = { addPlayer: true } } = {}) {
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
        role: 'staff',
        status: activeProfile ? 'active' : 'suspended',
        permissions,
      }
      return new Response(JSON.stringify(profile), {
        status: 200,
        headers: { 'content-type': 'application/vnd.pgrst.object+json' },
      })
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
    installAuthStub()
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
    installAuthStub()
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

  console.log(`\n${n} tests passed${failed ? `, ${failed} FAILED` : ''}`)
  if (failed) process.exit(1)
}

run()
