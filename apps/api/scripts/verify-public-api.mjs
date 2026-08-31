#!/usr/bin/env node
// docs/brief-thread-public-api.md, made runnable.
//
// The Thread publishes three read routes that any website may call from the
// browser. Published means CLAUDE.md rule 8 applies: add fields, never rename,
// remove, retype or re-mean one. This script asserts that, plus the three
// things that make the opening safe rather than merely open:
//
//   1. The three routes answer, and keep every published key.
//   2. Internal columns stay out. `{ ...thread }` used to ship workspace_id,
//      team_id, organiser_id and payment_destination to the internet; this is
//      the guard that stops the next migration doing it again.
//   3. CORS is open on those three paths — and NOT on their neighbours.
//      POST /public/enrol and POST /public/validate-coupon share the prefix
//      and are called from the browser by the enrol form. A prefix-wide
//      cors() answers their preflight with "GET, OPTIONS" and enrolment stops
//      working. Step 3 is the one that would have caught that.
//   4. Third-party browser traffic is rate limited; our own is not.
//
// READ ONLY. It writes nothing, so unlike verify-external-app.mjs it needs no
// confirmation gate. It reads apps/api/.env only to find a real published
// thread to point at.
//
// Usage:
//   node scripts/verify-public-api.mjs
//   FIBRE_API=https://thefibre-api.fly.dev node scripts/verify-public-api.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=', 2))
    .filter((p) => p.length === 2),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const API = process.env.FIBRE_API ?? 'http://localhost:8080';

// A stranger's website. Nothing here is ours.
const THIRD_PARTY = 'https://festivaloftrust.example';
const OUR_ORIGIN = 'https://thread.thefibre.app';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase keys in apps/api/.env');
  process.exit(1);
}

let failures = 0;

function step(n, label) {
  console.log(`\n${n}. ${label}`);
}

function check(ok, label, detail) {
  console.log(`   ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Every key the contract promises is still present. Extra keys are fine. */
function checkShape(label, obj, keys) {
  if (!obj || typeof obj !== 'object') {
    check(false, `${label} keeps its published keys`, `got ${obj === null ? 'null' : typeof obj}`);
    return;
  }
  const missing = keys.filter((k) => !(k in obj));
  check(
    missing.length === 0,
    `${label} keeps its published keys`,
    missing.length ? `MISSING ${missing.join(', ')}` : `${keys.length} keys`,
  );
}

/** Internal plumbing that must never appear in a public payload. */
function checkNoInternals(label, obj, forbidden) {
  if (!obj || typeof obj !== 'object') return;
  const leaked = forbidden.filter((k) => k in obj);
  check(
    leaked.length === 0,
    `${label} leaks no internal columns`,
    leaked.length ? `LEAKED ${leaked.join(', ')}` : `${forbidden.length} checked`,
  );
}

async function get(path, { origin, method = 'GET', headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  const res = await fetch(`${API}${path}`, { method, headers: h });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, headers: res.headers, body: json, text };
}

// --- the published shapes --------------------------------------------------

const SHAPES = {
  organiser: ['id', 'slug', 'display_name', 'bio', 'photo_url', 'timezone'],
  listItem: [
    'id',
    'slug',
    'intention',
    'cover_url',
    'capacity',
    'price_cents',
    'price_currency',
    'public_interaction',
    'program',
  ],
  embedItem: [
    'id',
    'slug',
    'organiser_slug',
    'organiser_name',
    'title',
    'format',
    'status',
    'starts_on',
    'ends_on',
    'intention',
    'cover_url',
    'price_cents',
    'price_currency',
    'language',
    'public_interaction',
    'categories',
    'url',
  ],
  thread: [
    'id',
    'slug',
    'intention',
    'timezone',
    'language',
    'cover_url',
    'capacity',
    'requires_approval',
    'certificate_enabled',
    'share_participants_public',
    'public_agenda',
    'categories',
    'registration_fields',
    'price_cents',
    'price_currency',
    'payment_methods',
    'program',
    'tickets',
    'agenda',
    'enrolled_count',
    'enrolment_open',
  ],
  agendaItem: ['id', 'title', 'description', 'type', 'starts_at', 'ends_at', 'location', 'is_online'],
};

const INTERNAL = ['workspace_id', 'team_id', 'organiser_id', 'payment_destination'];

// ---------------------------------------------------------------------------

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

console.log(`The Thread — public read API contract\nAPI: ${API}`);

// Find a real published thread to assert against.
const { data: candidates } = await db
  .from('thread_thread')
  .select('slug, workspace_id, organiser:organiser_id (slug), team:team_id (slug), program:program_id (status)')
  .eq('is_public_listed', true)
  .limit(25);

const one = (v) => (Array.isArray(v) ? v[0] : v);
const live = (candidates ?? []).find((t) => {
  const p = one(t.program);
  const owner = one(t.team)?.slug ?? one(t.organiser)?.slug;
  return owner && p && (p.status === 'active' || p.status === 'completed');
});

if (!live) {
  console.error(
    '\nNo public listed thread with an active programme was found, so there is\n' +
      'nothing to assert the contract against. Publish one, or run\n' +
      '`node scripts/seed-ebbf.mjs` first.',
  );
  process.exit(1);
}

const OWNER = one(live.team)?.slug ?? one(live.organiser)?.slug;
const THREAD = live.slug;
// The listing is queried by workspace, not by owner slug: ?organiser= wants a
// thread_organiser slug, and a team thread's owner slug is the TEAM's — so
// filtering by owner would come back empty for half the fixtures and quietly
// skip the shape assertion.
const WORKSPACE = live.workspace_id;
console.log(`Fixture: /${OWNER}/${THREAD}`);

// ---- 1. The routes answer, and keep their shape ---------------------------
step(1, 'The three published routes keep their shape');

const organiserRes = await get(`/api/v1/thread/public/organiser/${OWNER}`);
check(organiserRes.status === 200, 'GET /public/organiser/:slug', `HTTP ${organiserRes.status}`);
checkShape('organiser', organiserRes.body?.organiser, SHAPES.organiser);
checkShape('organiser thread', organiserRes.body?.threads?.[0], SHAPES.listItem);
check(
  typeof organiserRes.body?.owner_kind === 'string',
  'organiser payload keeps owner_kind',
  organiserRes.body?.owner_kind,
);

const threadRes = await get(`/api/v1/thread/public/organiser/${OWNER}/thread/${THREAD}`);
check(threadRes.status === 200, 'GET /public/organiser/:slug/thread/:slug', `HTTP ${threadRes.status}`);
checkShape('thread', threadRes.body?.thread, SHAPES.thread);
checkShape('thread organiser', threadRes.body?.organiser, SHAPES.organiser);
if (threadRes.body?.thread?.agenda?.length) {
  checkShape('agenda item', threadRes.body.thread.agenda[0], SHAPES.agendaItem);
}

const embedRes = await get(`/api/v1/thread/public/embed/threads?workspace=${WORKSPACE}`);
check(embedRes.status === 200, 'GET /public/embed/threads', `HTTP ${embedRes.status}`);
check(
  (embedRes.body?.items?.length ?? 0) > 0,
  'the listing returns the workspace\u2019s public threads',
  `${embedRes.body?.items?.length ?? 0} items`,
);
checkShape('embed item', embedRes.body?.items?.[0], SHAPES.embedItem);

// ---- 2. Nothing internal rides along --------------------------------------
step(2, 'Internal columns stay on our side of the wire');

checkNoInternals('thread', threadRes.body?.thread, INTERNAL);
checkNoInternals('thread organiser', threadRes.body?.organiser, INTERNAL);
checkNoInternals('organiser', organiserRes.body?.organiser, INTERNAL);
checkNoInternals('organiser thread', organiserRes.body?.threads?.[0], INTERNAL);

// An unlisted join link is not agenda copy.
const leakedUrl = (threadRes.body?.thread?.agenda ?? []).some((a) => 'meeting_url' in a);
check(!leakedUrl, 'agenda items expose is_online, never meeting_url');

// ---- 3. Open where intended, closed where not -----------------------------
step(3, 'CORS is open on these three paths and nowhere near their neighbours');

const stranger = await get(`/api/v1/thread/public/embed/threads?workspace=${WORKSPACE}`, {
  origin: THIRD_PARTY,
});
check(
  stranger.headers.get('access-control-allow-origin') === '*',
  "a stranger's website may read the listing",
  stranger.headers.get('access-control-allow-origin') ?? 'no header',
);
check(
  stranger.headers.get('access-control-allow-credentials') !== 'true',
  'open origin never carries credentials',
  stranger.headers.get('access-control-allow-credentials') ?? 'absent',
);

const preflight = await get(`/api/v1/thread/public/organiser/${OWNER}/thread/${THREAD}`, {
  method: 'OPTIONS',
  origin: THIRD_PARTY,
  headers: { 'Access-Control-Request-Method': 'GET' },
});
check(
  preflight.headers.get('access-control-allow-origin') === '*',
  'preflight for a published GET is answered',
  `HTTP ${preflight.status}`,
);

// The neighbours. These share the /public/ prefix and must NOT be open.
const enrolFromStranger = await get('/api/v1/thread/public/enrol', {
  method: 'OPTIONS',
  origin: THIRD_PARTY,
  headers: { 'Access-Control-Request-Method': 'POST' },
});
check(
  enrolFromStranger.headers.get('access-control-allow-origin') !== '*',
  'POST /public/enrol is NOT open to strangers',
  enrolFromStranger.headers.get('access-control-allow-origin') ?? 'no header',
);

const couponFromStranger = await get('/api/v1/thread/public/validate-coupon', {
  method: 'OPTIONS',
  origin: THIRD_PARTY,
  headers: { 'Access-Control-Request-Method': 'POST' },
});
check(
  couponFromStranger.headers.get('access-control-allow-origin') !== '*',
  'POST /public/validate-coupon is NOT open to strangers',
  couponFromStranger.headers.get('access-control-allow-origin') ?? 'no header',
);

// And the regression that scoping to three exact paths exists to prevent:
// our own enrol form still gets its preflight answered.
const enrolFromUs = await get('/api/v1/thread/public/enrol', {
  method: 'OPTIONS',
  origin: OUR_ORIGIN,
  headers: { 'Access-Control-Request-Method': 'POST' },
});
const allowedMethods = enrolFromUs.headers.get('access-control-allow-methods') ?? '';
check(
  enrolFromUs.headers.get('access-control-allow-origin') === OUR_ORIGIN &&
    allowedMethods.includes('POST'),
  'our own enrol form can still POST (the break this scoping prevents)',
  `origin=${enrolFromUs.headers.get('access-control-allow-origin') ?? 'none'} methods=${allowedMethods || 'none'}`,
);

// ---- 4. The brake is on the new traffic only ------------------------------
step(4, 'Rate limiting applies to third-party browsers, not to us');

check(
  stranger.headers.get('x-ratelimit-remaining') !== null,
  'a third-party origin is told its remaining budget',
  stranger.headers.get('x-ratelimit-remaining') ?? 'no header',
);

const ours = await get(`/api/v1/thread/public/embed/threads?workspace=${WORKSPACE}`, {
  origin: OUR_ORIGIN,
});
check(
  ours.headers.get('x-ratelimit-remaining') === null,
  'our own pages are not metered (they all share a Vercel egress IP)',
  ours.headers.get('x-ratelimit-remaining') ?? 'unmetered',
);

const serverToServer = await get(`/api/v1/thread/public/embed/threads?workspace=${WORKSPACE}`);
check(
  serverToServer.headers.get('x-ratelimit-remaining') === null,
  'server-to-server calls (no Origin) are not metered',
  serverToServer.headers.get('x-ratelimit-remaining') ?? 'unmetered',
);

// ---------------------------------------------------------------------------
console.log(
  failures === 0
    ? '\nAll good — the published contract holds.'
    : `\n${failures} check${failures === 1 ? '' : 's'} failed.`,
);
process.exit(failures === 0 ? 0 : 1);
