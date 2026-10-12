// Server-side check of a Cloudflare Turnstile token ("Siteverify").
// WHY: the widget in the browser alone protects nothing; Cloudflare's docs say every token must be validated by the server.
// A token is valid for 300 seconds and can be validated ONCE (a replay fails with `timeout-or-duplicate`).
// This file has no Deno-only code (only fetch), so the same module is unit-tested in Node (supabase/tests/turnstile.test.mjs).
// Docs (official, checked 2026-10-12):
//   https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//   dummy test keys: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'missing-token' | 'rejected' | 'unreachable'; errorCodes?: string[] }

// Fails CLOSED: if Cloudflare cannot be reached or answers anything unexpected, the request is refused.
export async function verifyTurnstile(secret: string, token: unknown, remoteIp?: string | null): Promise<TurnstileResult> {
  // Our own sanity bound on the token size (not a documented Cloudflare limit): refuse empty or absurdly long input.
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096) return { ok: false, reason: 'missing-token' }

  const form = new URLSearchParams({ secret, response: token })
  if (remoteIp) form.set('remoteip', remoteIp)

  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) })
    const data = (await res.json()) as { success?: unknown; 'error-codes'?: unknown }
    if (data.success === true) return { ok: true }
    const codes = Array.isArray(data['error-codes']) ? data['error-codes'].filter((c): c is string => typeof c === 'string') : undefined
    return { ok: false, reason: 'rejected', errorCodes: codes }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}
