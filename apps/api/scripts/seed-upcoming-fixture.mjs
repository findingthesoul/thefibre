#!/usr/bin/env node
// A member with TWO team calendars, on STAGING, for looking at my.thread's
// Upcoming page signed in and for timing /me/portal with memberships.
//
//   node scripts/seed-upcoming-fixture.mjs [--email <addr>]
//
// Until this existed nothing on staging held a team-calendar entitlement (one
// stray grant in a leftover test workspace, 2026-10-14), so the page could
// only ever say "none of your memberships includes a team calendar", and the
// /me/portal timing in docs/handover-portal-entitlements-batching.md measured
// a loop that did nothing. This is step 1 of that handover.
//
// The shape is the one soul.com sells, both routes to a calendar:
//   · Choir — the team calendar is granted ON THE TIER, at 100%.
//   · Band  — the team calendar is granted through a PRODUCT the tier
//             includes, at 20%. The route the tier-only lookup used to miss.
// Each calendar carries three threads, all published and open for sign-up:
// one publicly LISTED, one NOT listed (the Public switch off — Sjoerd: "As it
// is published they can see it"), and one with a REQUIRED sign-up question,
// which must show "Sign up on its page" rather than a one-click join.
//
// PERMANENT workspaces with their content replaced on every run, never a
// workspace created and deleted: a join writes append-only activity, and a
// workspace that ever hosted one can never be hard-deleted. Team slugs stay
// put (they live in the global public_root_slug namespace).
//
// --email <addr> gives the two memberships to a REAL staging address instead
// of the fixture's, so a person can sign in to my.thefibre.tech as
// themselves and look. (An admin magic link does not work for that: my.thread's
// callback only completes the PKCE `?code=` path.) Only the two fixture
// workspaces are touched either way.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const envFile = process.env.FIBRE_ENV_FILE_STAGING ?? join(HERE, '..', '.env.staging');
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const PROD_REF = 'zfsyyokepyycefbxiblc';
if (!env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.includes(PROD_REF)) {
  console.error('REFUSED: this seeds STAGING only, and the env file points at production or nowhere.');
  process.exit(2);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const flag = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const FIXTURE_EMAIL = (flag('email') ?? 'upcoming-fixture@example.com').trim().toLowerCase();

const CALENDARS = [
  { ws: 'fixture-upcoming-choir', name: 'Upcoming fixture — Choir', team: 'fixture-choir', teamName: 'Choir', route: 'tier', pct: 100 },
  { ws: 'fixture-upcoming-band', name: 'Upcoming fixture — Band', team: 'fixture-band', teamName: 'Band', route: 'product', pct: 20 },
];

const must = (what, r) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
const ins = async (table, row) => must(table, await db.from(table).insert(row).select('id').single()).id;

/** In the future whatever day this runs, so the threads stay joinable. */
const day = (offset) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

async function workspace(c) {
  const found = must('workspace', await db.from('workspace').select('id').eq('slug', c.ws).maybeSingle());
  const id = found?.id ?? (await ins('workspace', { slug: c.ws, name: c.name }));
  for (const slug of ['membership', 'the-thread']) {
    const app = must(`app ${slug}`, await db.from('app').select('id').eq('slug', slug).single());
    must(
      'workspace_app',
      await db.from('workspace_app').upsert({ workspace_id: id, app_id: app.id }, { onConflict: 'workspace_id,app_id' }),
    );
  }
  return id;
}

/** Yesterday's content, so every run starts from the same place. */
async function clear(ws) {
  const threads = must('threads', await db.from('thread_thread').select('id, program_id').eq('workspace_id', ws)) ?? [];
  const threadIds = threads.map((t) => t.id);
  if (threadIds.length) {
    // A join from the page leaves these; they go so the list is full again.
    for (const table of ['thread_enrolment', 'thread_ticket']) {
      const r = await db.from(table).delete().in('thread_id', threadIds);
      if (r.error) console.warn(`  ${table}: ${r.error.message}`);
    }
    const r = await db.from('thread_thread').delete().in('id', threadIds);
    if (r.error) console.warn(`  thread_thread: ${r.error.message}`);
  }
  const programIds = threads.map((t) => t.program_id).filter(Boolean);
  if (programIds.length) {
    await db.from('enrolment').delete().in('program_id', programIds);
    const r = await db.from('program').delete().in('id', programIds);
    if (r.error) console.warn(`  program: ${r.error.message}`);
  }
  const tiers = must('tiers', await db.from('membership_tier').select('id').eq('workspace_id', ws)) ?? [];
  if (tiers.length) await db.from('membership_tier_product').delete().in('tier_id', tiers.map((t) => t.id));
  for (const table of ['membership_access_grant', 'membership_member', 'membership_product', 'membership_tier']) {
    const r = await db.from(table).delete().eq('workspace_id', ws);
    if (r.error) console.warn(`  ${table}: ${r.error.message}`);
  }
}

async function seed(c) {
  const ws = await workspace(c);
  await clear(ws);

  const team =
    must('team', await db.from('team').select('id').eq('slug', c.team).maybeSingle())?.id ??
    (await ins('team', { workspace_id: ws, name: c.teamName, slug: c.team }));
  must('team publish', await db.from('team').update({ is_published: true, is_active: true }).eq('id', team));

  const user =
    must('user', await db.from('user').select('id').eq('workspace_id', ws).eq('email', `organiser+${c.team}@example.com`).maybeSingle())?.id ??
    (await ins('user', { workspace_id: ws, email: `organiser+${c.team}@example.com` }));
  const organiser =
    must('organiser', await db.from('thread_organiser').select('id').eq('user_id', user).maybeSingle())?.id ??
    (await ins('thread_organiser', { user_id: user, workspace_id: ws, slug: `${c.team}-organiser` }));

  const threadApp = must('app', await db.from('app').select('id').eq('slug', 'the-thread').single()).id;
  const threads = [
    { slug: `${c.team}-listed`, title: `${c.teamName}: open rehearsal`, listed: true, required: false, start: 10 },
    { slug: `${c.team}-unlisted`, title: `${c.teamName}: members' evening (Public off)`, listed: false, required: false, start: 20 },
    { slug: `${c.team}-question`, title: `${c.teamName}: weekend, with a question`, listed: true, required: true, start: 30 },
  ];
  for (const t of threads) {
    const program = await ins('program', {
      workspace_id: ws,
      app_id: threadApp,
      title: t.title,
      format: 'journey',
      status: 'active',
      starts_on: day(t.start),
      ends_on: day(t.start + 1),
    });
    await ins('thread_thread', {
      workspace_id: ws,
      program_id: program,
      organiser_id: organiser,
      team_id: team,
      slug: t.slug,
      intention: 'A fixture for the Upcoming page in my.thread.',
      public_scope: 'team',
      is_public_listed: t.listed,
      public_enrolment_open: true,
      price_cents: 5000,
      price_currency: 'EUR',
      registration_fields: t.required
        ? [{ key: 'diet', label: 'Anything we should know about food?', type: 'short', required: true }]
        : [],
    });
  }

  const tier = await ins('membership_tier', { workspace_id: ws, name: `${c.teamName} member`, currency: 'EUR' });
  const config = { team_id: team, discount_pct: c.pct };
  if (c.route === 'tier') {
    await ins('membership_access_grant', { workspace_id: ws, tier_id: tier, kind: 'team_calendar', config });
  } else {
    const product = await ins('membership_product', { workspace_id: ws, name: `${c.teamName} calendar` });
    await ins('membership_access_grant', { workspace_id: ws, product_id: product, kind: 'team_calendar', config });
    must(
      'tier product',
      await db.from('membership_tier_product').insert({ tier_id: tier, product_id: product, optional: false }),
    );
  }

  const person =
    must('person', await db.from('person').select('id').eq('workspace_id', ws).eq('email', FIXTURE_EMAIL).is('deleted_at', null).maybeSingle())?.id ??
    (await ins('person', { workspace_id: ws, first_name: 'Upcoming', last_name: 'Fixture', email: FIXTURE_EMAIL }));
  // Clear() removed the old membership rows; a person row for a REAL address
  // is kept (it may carry other things) and only gains a membership.
  // A far-future renewal: the staging API's real scheduler runs against this
  // database and would otherwise lapse the membership within days.
  await ins('membership_member', {
    workspace_id: ws,
    person_id: person,
    tier_id: tier,
    status: 'active',
    started_at: new Date().toISOString(),
    renews_at: '2099-01-01T00:00:00Z',
  });
  console.log(`  ${c.ws}: team ${c.team} via ${c.route} at ${c.pct}%, 3 threads`);
}

console.log(`Seeding the Upcoming fixture on ${env.NEXT_PUBLIC_SUPABASE_URL}`);
for (const c of CALENDARS) await seed(c);

// Make sure an auth user exists, so the address can sign in with a code.
const { data: exists } = await db.rpc('auth_user_exists', { p_email: FIXTURE_EMAIL });
if (exists !== true) {
  const r = await db.auth.admin.createUser({ email: FIXTURE_EMAIL, email_confirm: true });
  if (r.error) console.warn(`  auth user: ${r.error.message}`);
}

console.log(`Done. ${FIXTURE_EMAIL} should see 4 one-click rows and 2 "Sign up on its page" rows:`);
console.log('  Choir rows "included in your membership"; Band rows €40 instead of €50.');
