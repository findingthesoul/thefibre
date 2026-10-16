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
import { supabaseEnv } from './lib/env.mjs';

let SUPABASE_URL, SERVICE_KEY;
try {
  ({ url: SUPABASE_URL, serviceKey: SERVICE_KEY } = supabaseEnv());
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const API = process.env.FIBRE_API ?? 'http://localhost:8080';

// A stranger's website. Nothing here is ours.
const THIRD_PARTY = 'https://festivaloftrust.example';
const OUR_ORIGIN = 'https://app.thethread.app';

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
  // bio_html joined on 2026-10-03 and short_bio on 2026-10-07, each on the
  // day production began serving it (both waited in PENDING below until then,
  // as the comment there describes).
  organiser: [
    'id',
    'slug',
    'display_name',
    'bio',
    'bio_html',
    'short_bio',
    'photo_url',
    'timezone',
  ],
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
    // Thread dates part 4 (v1.220.0) and the incl.-VAT rate, collected with
    // batch 32 (2026-10-16).
    'event_starts_at',
    'event_ends_at',
    'key_moment_count',
    'signups_close_at',
    'language',
    'timezone',
    'vat_home_pct',
    // Whether the shown price already includes VAT, and the item's own
    // address (multi-team: on a team's page an offered thread lives at its
    // owner's), collected with batch 35 (2026-10-17).
    'price_includes_vat',
    'path',
  ],
  // The organiser page envelope: the owner's card choice (thread dates part
  // 4), collected with batch 32.
  organiserPage: ['card_dates'],
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
    // Collected 2026-10-15, the day batch 27 put them on production: the
    // team per item (embed filters) and the thread dates (part 1).
    'team',
    'event_starts_at',
    'event_ends_at',
    'key_moment_count',
    'signups_close_at',
    // The thread's zone (thread dates part 3), collected with batch 31
    // (2026-10-16).
    'timezone',
    // Whether the shown price already includes VAT, collected with batch 35
    // (2026-10-17).
    'price_includes_vat',
  ],
  // The listing envelope. `truncated` collected with batch 27; the card
  // choice (thread dates part 3) with batch 31.
  embedListing: ['items', 'truncated', 'card_dates'],
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
    // Thread dates part 1, collected with batch 27 (2026-10-15).
    'event_starts_at',
    'event_ends_at',
    'key_moment_count',
    'signups_close_at',
    // Thread dates part 2, collected with batch 28 (2026-10-15).
    'signups_closed',
    // VAT on top (Thread/Meet), collected with batch 30 (2026-10-15).
    'vat_registered',
    // The workspace's card choice (thread dates part 3), collected with
    // batch 31 (2026-10-16).
    'card_dates',
    // The seller's home VAT rate for the "incl. VAT" line, collected with
    // batch 32 (2026-10-16).
    'vat_home_pct',
    // Whether the shown price already includes VAT, collected with batch 34
    // (2026-10-16).
    'price_includes_vat',
  ],
  agendaItem: ['id', 'title', 'description', 'type', 'starts_at', 'ends_at', 'location', 'is_online', 'hosts'],
};

const INTERNAL = ['workspace_id', 'team_id', 'organiser_id', 'payment_destination'];

// Fields this repo has ADDED to a published payload which production does not
// serve yet — `pnpm verify` points at https://thefibre-api.fly.dev, so a new
// field cannot be asserted in the release that introduces it; the API reaches
// production days later, through promote + deploy-api.
//
// Listing one here is not a weaker check, it is a check of the other thing:
// while the field is absent this says so without failing, and the moment
// production serves it this FAILS and tells you to move it into SHAPES. So
// the list cannot quietly become permanent — the deploy itself collects it.
const PENDING = {
  // Empty again since 2026-10-07. Two fields have passed through: `bio_html`
  // (added 2026-10-02, collected 10-03) and `short_bio` (added 10-07,
  // collected the same day, in batch 8 — the release that deployed it).
  // The key stays so the two checkPending calls below keep working when the
  // next field waits.
  //
  // What both days proved: an entry here blocks EVERYONE's gate the moment
  // production serves it, not only its author's. It is a promise to collect
  // it that same day, in the session that deploys, not a parking spot. This
  // collection was somebody else's field and somebody else's deploy; the gate
  // does not care whose, which is the point of it going red for all of us.
  organiser: [],
  // Empty again: `hosts` (added 2026-10-15, v1.199.0) was collected into
  // SHAPES.agendaItem the morning batch 25 put it on production.
  agendaItem: [],
  // Empty again: `team`, `truncated` and the four thread-date fields were
  // collected into SHAPES the day batch 27 put them on production.
  // Empty again: `timezone` and the listing's `card_dates` (thread dates
  // part 3) were collected into SHAPES with batch 31.
  // Empty again: `price_includes_vat` on the list and embed items (emitted
  // from v1.246.5) and the list item's `path` were collected into SHAPES
  // the day batch 35 put them on production (2026-10-17).
  embedItem: [],
  embedListing: [],
  // Empty again: `vat_home_pct` (thread), the seven list-item fields and the
  // organiser page's `card_dates` were collected into SHAPES with batch 32.
  thread: [],
  listItem: [],
  organiserPage: [],
};

/** A pending field: silent-ish while absent, loud once it is live. */
// `shape` names the PENDING list and the SHAPES list it moves to. The hint
// used to guess it from the label's last word, which sent the organiser-page
// items to SHAPES.thread (they are SHAPES.listItem) and the page envelope to
// SHAPES.page (it is SHAPES.organiserPage).
function checkPending(label, obj, shape) {
  if (!obj || typeof obj !== 'object') return;
  const keys = PENDING[shape];
  for (const k of keys) {
    if (k in obj) {
      check(false, `${label}.${k} is live`, `MOVE it into SHAPES.${shape} — production serves it now`);
    } else {
      console.log(`   · ${label}.${k} — published by this repo, not deployed yet`);
    }
  }
}

// ---------------------------------------------------------------------------

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

console.log(`The Thread — public read API contract\nAPI: ${API}`);

// Find a real published thread to assert against.
const { data: candidates } = await db
  .from('thread_thread')
  .select('slug, is_public_listed, workspace_id, organiser:organiser_id (slug), team:team_id (slug), program:program_id (status)')
  .eq('is_public_listed', true)
  .limit(25);

const one = (v) => (Array.isArray(v) ? v[0] : v);
const live = (candidates ?? []).find((t) => {
  const p = one(t.program);
  const owner = one(t.team)?.slug ?? one(t.organiser)?.slug;
  return owner && p && (p.status === 'active' || p.status === 'completed');
});

if (!live) {
  // Say WHICH of the three conditions each candidate failed. The old message
  // named none of them, so an environment with threads that were merely in
  // draft read identically to one with no threads at all — and the advice
  // ("publish one, or seed") was wrong for both.
  const why = (t) => {
    const p = one(t.program);
    const owner = one(t.team)?.slug ?? one(t.organiser)?.slug;
    const missing = [];
    if (!t.is_public_listed) missing.push('not public-listed');
    if (!owner) missing.push('no owner slug');
    if (!p) missing.push('no programme');
    else if (p.status !== 'active' && p.status !== 'completed')
      missing.push(`programme is ${p.status}`);
    return `  ${t.slug} — ${missing.join(', ')}`;
  };
  const all = candidates ?? [];
  console.error(
    `\nNo thread here satisfies all three conditions the published contract ` +
      `needs:\npublic-listed, an owner slug, and a programme that is active or ` +
      `completed.\n`,
  );
  if (!all.length) {
    console.error('This environment has no public-listed threads at all.');
  } else {
    console.error(`${all.length} public-listed thread(s) considered:`);
    for (const t of all) console.error(why(t));
  }
  console.error(
    `\nFix by moving one of those threads' programmes to active, or by ` +
      `publishing\na thread that qualifies. Do NOT reach for seed-ebbf.mjs on ` +
      `staging: it targets\nthe 'default' workspace, which is the Stripe ` +
      `payment-rehearsal rig.`,
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
checkPending('organiser', organiserRes.body?.organiser, 'organiser');
checkShape('organiser thread', organiserRes.body?.threads?.[0], SHAPES.listItem);
checkPending('organiser thread', organiserRes.body?.threads?.[0], 'listItem');
checkShape('organiser page', organiserRes.body, SHAPES.organiserPage);
checkPending('organiser page', organiserRes.body, 'organiserPage');
check(
  typeof organiserRes.body?.owner_kind === 'string',
  'organiser payload keeps owner_kind',
  organiserRes.body?.owner_kind,
);

// PLAIN TEXT MEANS NO TAGS. `bio` has been published as a plain string since
// v0.18.15 and an app outside this repo renders it as one; stored bios are
// HTML now, so the flattening in publicOrganiser is the only thing keeping
// the promise. A shape check cannot see this: the type is still `string`.
const TAGS = /<\/?[a-z][^>]*>/i;
function checkPlain(where, value) {
  if (value == null) return;
  const markup = TAGS.test(String(value));
  check(
    !markup,
    `${where} is plain text (no markup)`,
    markup ? `FOUND MARKUP: ${String(value).slice(0, 60)}` : `${String(value).length} chars, no tags`,
  );
}
checkPlain('organiser.bio', organiserRes.body?.organiser?.bio);
checkPlain('organiser.short_bio', organiserRes.body?.organiser?.short_bio);

const threadRes = await get(`/api/v1/thread/public/organiser/${OWNER}/thread/${THREAD}`);
check(threadRes.status === 200, 'GET /public/organiser/:slug/thread/:slug', `HTTP ${threadRes.status}`);
checkShape('thread', threadRes.body?.thread, SHAPES.thread);
checkShape('thread organiser', threadRes.body?.organiser, SHAPES.organiser);
checkPending('thread organiser', threadRes.body?.organiser, 'organiser');
checkPlain('thread organiser.bio', threadRes.body?.organiser?.bio);
checkPlain('thread organiser.short_bio', threadRes.body?.organiser?.short_bio);
if (threadRes.body?.thread?.agenda?.length) {
  checkShape('agenda item', threadRes.body.thread.agenda[0], SHAPES.agendaItem);
  checkPending('agendaItem', threadRes.body.thread.agenda[0], 'agendaItem');
}
checkPending('thread', threadRes.body?.thread, 'thread');

// ---- Meet's public host payload ------------------------------------------
// Not part of the Thread contract, and checked here anyway, because it is a
// PUBLIC no-auth endpoint whose `bio` is read as a string by whoever calls
// it — and until v1.162.0 it returned markup there (five of nine production
// hosts had an HTML bio). The assertion that would have caught it is the one
// the Thread routes get, so it gets the same one.
//
// The fixture is chosen by what it IS — a host whose stored bio contains
// markup — rather than by name, so the check keeps biting as staging and
// production data change. If no such host exists the check says so instead
// of passing on nothing.
// DETERMINISTIC, and only hosts the public route can actually answer for.
// It took `.limit(50)` with no order and no slug filter, so "the first host"
// changed with the data: on 2026-10-14 it landed on a host the public route
// 404s (the route's `.eq('slug').single()` errors on a NULL slug and on a
// slug two hosts share) and blocked every release. So: slugs present,
// ordered, and a slug that appears more than once is skipped — the check
// stays exactly as strict, it just stops choosing a host it cannot pass on.
const { data: hostRows } = await db
  .from('meet_host')
  .select('slug, bio, user:user_id (email)')
  .not('slug', 'is', null)
  .order('slug')
  .limit(200);
const slugCount = new Map();
for (const h of hostRows ?? []) slugCount.set(h.slug, (slugCount.get(h.slug) ?? 0) + 1);
const duplicateSlugs = [...slugCount].filter(([, n]) => n > 1).map(([sl]) => sl);
if (duplicateSlugs.length) {
  // A data finding, said out loud: two hosts on one public address means
  // that address cannot open for either of them.
  console.log(`   ⚠ meet hosts sharing a slug (skipped here; their public page cannot open): ${duplicateSlugs.join(', ')}`);
}
const meetHosts = (hostRows ?? []).filter((h) => slugCount.get(h.slug) === 1);
const hostEmails = [
  ...new Set((meetHosts ?? []).map((h) => one(h.user)?.email).filter(Boolean)),
];
const { data: hostProfiles } = hostEmails.length
  ? await db.from('identity_profile').select('email, bio').in('email', hostEmails)
  : { data: [] };
const profileBio = new Map(
  (hostProfiles ?? []).map((r) => [String(r.email).toLowerCase(), r.bio]),
);
const HAS_MARKUP = /<\/?[a-z][^>]*>/i;
const markupHost = (meetHosts ?? []).find((h) => {
  const stored = profileBio.get(String(one(h.user)?.email ?? '').toLowerCase()) ?? h.bio;
  return stored && HAS_MARKUP.test(String(stored));
});

if (!markupHost) {
  // Not a failure: a stack whose every bio is still plain text cannot
  // exercise this. Said out loud, because a silent skip reads as a pass.
  console.log('   ⚠ no Meet host has a stored bio containing markup — flattening NOT exercised');
} else {
  const hostRes = await get(`/api/v1/meet/public/host/${markupHost.slug}`);
  // The slug in the line, so the next failure names its host.
  check(hostRes.status === 200, `GET /meet/public/host/${markupHost.slug}`, `HTTP ${hostRes.status}`);
  checkPlain('meet host.bio', hostRes.body?.bio);
  checkPlain('meet host.short_bio', hostRes.body?.short_bio);
  // The markup has to be SOMEWHERE, or flattening has quietly become
  // deleting: a reader that wants the formatting needs the additive field.
  check(
    typeof hostRes.body?.bio_html === 'string' && HAS_MARKUP.test(hostRes.body.bio_html),
    'meet host.bio_html carries the markup instead',
    hostRes.body?.bio_html == null ? 'MISSING' : `${String(hostRes.body.bio_html).length} chars`,
  );
}

const embedRes = await get(`/api/v1/thread/public/embed/threads?workspace=${WORKSPACE}`);
check(embedRes.status === 200, 'GET /public/embed/threads', `HTTP ${embedRes.status}`);
check(
  (embedRes.body?.items?.length ?? 0) > 0,
  'the listing returns the workspace\u2019s public threads',
  `${embedRes.body?.items?.length ?? 0} items`,
);
checkShape('embed item', embedRes.body?.items?.[0], SHAPES.embedItem);
checkPending('embedItem', embedRes.body?.items?.[0], 'embedItem');
checkShape('embed listing', embedRes.body, SHAPES.embedListing);
checkPending('embedListing', embedRes.body, 'embedListing');

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
