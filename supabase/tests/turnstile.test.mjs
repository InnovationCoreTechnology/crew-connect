// Tests for supabase/functions/account-auth/turnstile.ts against the REAL Cloudflare Siteverify service, using
// Cloudflare's published DUMMY keys (https://developers.cloudflare.com/turnstile/troubleshooting/testing/). No account or secret needed.
// Run from the repo root:   node supabase/tests/turnstile.test.mjs        (needs Node 22.18+ so it can read the .ts file directly)
import assert from 'node:assert/strict'
import { verifyTurnstile } from '../functions/account-auth/turnstile.ts'

const PASS_SECRET = '1x0000000000000000000000000000000AA' // always passes validation
const FAIL_SECRET = '2x0000000000000000000000000000000AA' // always fails validation
const SPENT_SECRET = '3x0000000000000000000000000000000AA' // answers "token already spent"
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX' // what the dummy sitekeys hand to the browser

const cases = [
  ['a valid token passes', async () => assert.deepEqual(await verifyTurnstile(PASS_SECRET, DUMMY_TOKEN, '203.0.113.7'), { ok: true })],
  ['a token is refused when Cloudflare rejects it', async () => {
    const r = await verifyTurnstile(FAIL_SECRET, DUMMY_TOKEN)
    assert.equal(r.ok, false); assert.equal(r.reason, 'rejected')
  }],
  ['a replayed (already used) token is refused', async () => {
    const r = await verifyTurnstile(SPENT_SECRET, DUMMY_TOKEN)
    assert.equal(r.ok, false); assert.equal(r.reason, 'rejected'); assert.ok(r.errorCodes?.includes('timeout-or-duplicate'), `codes: ${r.errorCodes}`)
  }],
  ['a missing token is refused without calling Cloudflare', async () => {
    for (const bad of [undefined, null, '', 123, {}]) {
      const r = await verifyTurnstile(PASS_SECRET, bad)
      assert.deepEqual(r, { ok: false, reason: 'missing-token' })
    }
  }],
  ['an absurdly long token is refused', async () => assert.equal((await verifyTurnstile(PASS_SECRET, 'x'.repeat(5000))).reason, 'missing-token')],
  ['it fails CLOSED when Cloudflare is unreachable', async () => {
    const real = globalThis.fetch
    globalThis.fetch = async () => { throw new Error('network down') }
    try { assert.deepEqual(await verifyTurnstile(PASS_SECRET, DUMMY_TOKEN), { ok: false, reason: 'unreachable' }) } finally { globalThis.fetch = real }
  }],
  ['it fails CLOSED on a non-JSON answer', async () => {
    const real = globalThis.fetch
    globalThis.fetch = async () => new Response('<html>oops</html>', { status: 502 })
    try { assert.equal((await verifyTurnstile(PASS_SECRET, DUMMY_TOKEN)).ok, false) } finally { globalThis.fetch = real }
  }],
]

let failed = 0
for (const [name, run] of cases) {
  try { await run(); console.log('ok   -', name) } catch (e) { failed++; console.log('FAIL -', name, '\n      ', e.message) }
}
console.log(failed ? `\n${failed} test(s) FAILED` : '\nALL TURNSTILE TESTS PASSED')
process.exit(failed ? 1 : 0)
