// DEV-ONLY seed: fills the Supabase project with fake candidates, employers and jobs so the app can be tried.
//
// WHY a script (not SQL): logins live in Supabase Auth, and the supported way to create them is the Admin API
// (https://supabase.com/docs/reference/javascript/auth-admin-createuser). Writing into auth.users by hand is fragile.
// SAFE TO RE-RUN: it creates only what is missing. It never deletes anything.
// NEEDS the project's SECRET key. It bypasses all security rules, so:
//   - keep it ONLY in web/.env.seed.local (git-ignored, see .gitignore "*.local"), never in a VITE_ variable,
//   - never paste it into chat or commit it.
//
// Run:   npm run seed:dev            (from web/)
// Check: npm run seed:dev -- --dry-run   (prints the plan, touches nothing, needs no key)
//
// Fake accounts it creates (their numbers cannot receive SMS; to log in as one you need Supabase "test OTP" numbers
// or a real SMS provider for that number): candidate 9845000001, employer 9845000002 (Approved), admin 9845000000.

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const AREAS = ['Whitefield', 'Koramangala', 'HSR Layout', 'Indiranagar', 'Marathahalli', 'Electronic City', 'Jayanagar', 'Yelahanka']
const JOB_TYPES = ['Security', 'Housekeeping']
const SHIFTS = ['Day', 'Night', 'Any']
const NAMES = [
  'Ravi Kumar', 'Suresh Gowda', 'Manjunath R', 'Lakshmi Devi', 'Anita Kumari', 'Mohammed Irfan', 'Prakash S',
  'Savitha M', 'Ramesh Naik', 'Geetha B', 'Venkatesh P', 'Shanthi K', 'Arun Raj', 'Nagaraj H', 'Meena Kumari',
  'Basavaraj L', 'Pooja S', 'Imran Khan', 'Kavitha R', 'Dinesh Kumar',
]

// Same shape of data the old in-memory mock used, so the screens look familiar.
const candidates = NAMES.map((name, i) => ({
  phone: i === 0 ? '9845000001' : `98${45000000 + i * 137911}`,
  name,
  type: JOB_TYPES[i % 2],
  exp: (i * 3) % 11,
  area: AREAS[(i * 5) % 8],
  salary: (12 + ((i * 7) % 9)) * 1000,
  shift: SHIFTS[i % 3],
  avail: i % 4 ? 'Immediate' : '15 days',
  verified: i % 3 !== 1,
}))

const employers = [
  { phone: '9845000002', companyName: 'Prestige Facility Services', status: 'Approved' },
  { phone: '9900000002', companyName: 'Sunrise Apartments Association', status: 'Pending' },
  { phone: '9900000003', companyName: 'Metro Housekeeping Co.', status: 'Pending' },
  { phone: '9900000004', companyName: 'SafeGuard Security Agency', status: 'Approved' },
]

const ADMIN_PHONE = '9845000000'

const jobs = [
  { employer: '9845000002', title: 'Security Guard – Apartment Gate', type: 'Security', area: 'Whitefield', salary: 18000, shift: 'Night', openings: 4 },
  { employer: '9900000004', title: 'Security Supervisor', type: 'Security', area: 'Koramangala', salary: 24000, shift: 'Day', openings: 1 },
  { employer: '9845000002', title: 'Housekeeping Staff – Office', type: 'Housekeeping', area: 'Marathahalli', salary: 15000, shift: 'Day', openings: 6 },
  { employer: '9900000004', title: 'Housekeeping Supervisor', type: 'Housekeeping', area: 'HSR Layout', salary: 21000, shift: 'Day', openings: 2 },
  { employer: '9900000002', title: 'Security Guard – Society', type: 'Security', area: 'Yelahanka', salary: 16000, shift: 'Any', openings: 3 },
]

const allPhones = [...candidates.map((c) => c.phone), ...employers.map((e) => e.phone), ADMIN_PHONE]
const mask = (p) => `${p.slice(0, 2)}XXXXX${p.slice(7)}` // same shape as register_account() in the database

if (DRY_RUN) {
  console.log(`DRY RUN: would make sure ${allPhones.length} logins exist (${candidates.length} candidates, ${employers.length} employers, 1 admin) and ${jobs.length} jobs.`)
  console.log('Sample candidate:', JSON.stringify(candidates[0]))
  console.log('Nothing was changed.')
  process.exit(0)
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SECRET_KEY. Put them in web/.env.seed.local (see the header of this file).')
  process.exit(1)
}
if (process.env.SEED_CONFIRM !== 'crew-connect-dev') {
  console.error('Refusing to run. This writes fake data into the database. Add SEED_CONFIRM=crew-connect-dev to web/.env.seed.local to confirm this is the DEV project.')
  process.exit(1)
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
const check = (error, what) => {
  if (error) { console.error(`FAILED at: ${what} ->`, error.message); process.exit(1) }
}

// 1) Logins. Map existing ones first so the script is safe to repeat.
const existing = new Map() // national phone -> auth user id
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
  check(error, 'list users')
  for (const u of data.users) if (u.phone) existing.set(u.phone.slice(-10), u.id)
  if (data.users.length < 1000) break
}
const idFor = new Map()
for (const phone of allPhones) {
  if (existing.has(phone)) { idFor.set(phone, existing.get(phone)); continue }
  const { data, error } = await db.auth.admin.createUser({ phone: `+91${phone}`, phone_confirm: true })
  check(error, `create user ${mask(phone)}`)
  idFor.set(phone, data.user.id)
}

// 2) Profiles + role rows (same rows register_account() would create). upsert = safe to repeat.
const role = (p) => (p === ADMIN_PHONE ? 'admin' : employers.some((e) => e.phone === p) ? 'employer' : 'candidate')
check((await db.from('profiles').upsert(allPhones.map((p) => ({ id: idFor.get(p), role: role(p), phone: p })))).error, 'profiles')
check((await db.from('candidates').upsert(candidates.map((c) => ({
  id: idFor.get(c.phone), phone_masked: mask(c.phone), name: c.name, type: c.type, exp: c.exp, area: c.area,
  salary: c.salary, shift: c.shift, avail: c.avail, verified: c.verified,
})))).error, 'candidates')
check((await db.from('employers').upsert(employers.map((e) => ({
  id: idFor.get(e.phone), company_name: e.companyName, status: e.status, free_unlocks_left: 3,
})), { ignoreDuplicates: true })).error, 'employers') // ignoreDuplicates: never reset an employer's counters

// 3) Jobs: add only the ones that are not there yet (matched by employer + title).
for (const j of jobs) {
  const employerId = idFor.get(j.employer)
  const { data, error } = await db.from('jobs').select('id').eq('employer_id', employerId).eq('title', j.title).limit(1)
  check(error, `look up job ${j.title}`)
  if (data.length) continue
  check((await db.from('jobs').insert({
    employer_id: employerId, title: j.title, type: j.type, area: j.area, salary: j.salary, shift: j.shift, openings: j.openings,
  })).error, `insert job ${j.title}`)
}

console.log(`Seed done: ${allPhones.length} logins, ${candidates.length} candidates, ${employers.length} employers, ${jobs.length} jobs ensured.`)
