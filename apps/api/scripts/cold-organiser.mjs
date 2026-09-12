#!/usr/bin/env node
// Provision a BRAND-NEW organiser on staging and print a URL that signs you
// in as them — so you can look at the product the way a first client does,
// with none of your own history in the way.
//
// Why this exists: every other fixture path reuses an account that already
// has a workspace, contacts, threads and habits. That is precisely the thing
// a new client does not have, and the empty states, the first-run prompts and
// the "what do I even click" moments are invisible from a seeded account.
// The e2e helper (e2e/helpers.ts) deliberately picks an EXISTING user for
// stability; this is the opposite tool for the opposite job.
//
// Everything it makes is real: a workspace, a person, a platform user, an
// admin membership, the plan's apps, and a Supabase auth account. The
// sign-in link is a single-use SSO handoff code with a short TTL, the same
// mechanism the apps use between themselves.
//
// Usage:
//   FIBRE_ENV_FILE=.env.staging node scripts/cold-organiser.mjs
//   FIBRE_ENV_FILE=.env.staging node scripts/cold-organiser.mjs --name "Acme Choir"
//   FIBRE_ENV_FILE=.env.staging node scripts/cold-organiser.mjs --app the-thread
//   FIBRE_ENV_FILE=.env.staging node scripts/cold-organiser.mjs --list
//   FIBRE_ENV_FILE=.env.staging node scripts/cold-organiser.mjs --signin <slug>
//
// STAGING ONLY. It refuses to run anywhere else — it creates accounts, and a
// throwaway account in a production tenant is not throwaway, it is litter in
// a real customer's contact base.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, '..', process.env.FIBRE_ENV_FILE ?? '.env.staging');

let env;
try {
  env = Object.fromEntries(
    readFileSync(envFile, 'utf-8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
  );
} catch {
  console.error(`No env file at ${envFile}. Set FIBRE_ENV_FILE, e.g. .env.staging.`);
  process.exit(1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const STAGING_REF = 'lukhyylwhhjyihqtghvw';
if (!SUPABASE_URL.includes(STAGING_REF)) {
  console.error(
    `Refusing to run: ${SUPABASE_URL || '(no URL)'} is not the staging project.\n` +
      `This script creates accounts. Staging only.`,
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Hosts. Env-driven like everything else, with the staging defaults inline
// so the script works from a bare checkout.
const FIBRE = env.NEXT_PUBLIC_FIBRE_URL ?? 'https://thefibre.tech';
const HOSTS = {
  'fibre-platform': FIBRE,
  'the-thread': env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.tech',
  'fibre-meet': env.NEXT_PUBLIC_MEET_URL ?? 'https://meet.thefibre.tech',
};

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? '');
};

// Everything this script makes is tagged, so it can always be told apart
// from a real workspace and found again later.
const TAG = 'cold-';
const MAILDOMAIN = 'example.com'; // never routable; never mails a real person

async function mintSignIn(targetApp, userId, email, next) {
  const code = `cold-${randomBytes(24).toString('base64url')}`;
  const { error } = await db.from('sso_handoff').insert({
    code,
    user_id: userId,
    email,
    target_app: targetApp,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  if (error) throw new Error(`could not mint handoff code: ${error.message}`);
  const host = HOSTS[targetApp] ?? FIBRE;
  return `${host}/sso/land?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
}

async function list() {
  const { data } = await db
    .from('workspace')
    .select('slug, name, created_at')
    .like('slug', `${TAG}%`)
    .order('created_at', { ascending: false });
  if (!data?.length) {
    console.log('No cold organisers yet.');
    return;
  }
  console.log(`${data.length} cold organiser workspace(s):\n`);
  for (const w of data) {
    console.log(`  ${w.slug.padEnd(28)} ${w.name}   (${w.created_at.slice(0, 16).replace('T', ' ')})`);
  }
  console.log(`\nSign in as one:  node scripts/cold-organiser.mjs --signin <slug>`);
}

async function signinExisting(slug, targetApp, next) {
  const { data: ws } = await db.from('workspace').select('id, name').eq('slug', slug).maybeSingle();
  if (!ws) {
    console.error(`No workspace with slug "${slug}".`);
    process.exit(1);
  }
  const { data: user } = await db
    .from('user')
    .select('id, email')
    .eq('workspace_id', ws.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!user) {
    console.error(`Workspace "${slug}" has no user.`);
    process.exit(1);
  }
  const { data: auth } = await db.auth.admin.listUsers({ perPage: 200 });
  const match = auth?.users.find((a) => a.email?.toLowerCase() === user.email.toLowerCase());
  if (!match) {
    console.error(`No auth account for ${user.email}. Make a fresh one instead.`);
    process.exit(1);
  }
  console.log(`\n${ws.name} — ${user.email}\n`);
  console.log(await mintSignIn(targetApp, match.id, user.email, next));
  console.log('\nSingle use, valid 15 minutes.');
}

async function create(name, targetApp, next) {
  const stamp = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
  const slug = `${TAG}${stamp}`;
  const email = `cold-${stamp}@${MAILDOMAIN}`;
  const wsName = name || 'A brand-new organiser';

  const { data: ws, error: wsErr } = await db
    .from('workspace')
    .insert({ slug, name: wsName })
    .select('id')
    .single();
  if (wsErr) throw new Error(`workspace: ${wsErr.message}`);

  const { data: person, error: pErr } = await db
    .from('person')
    .insert({ workspace_id: ws.id, first_name: 'New', last_name: 'Organiser', email })
    .select('id')
    .single();
  if (pErr) throw new Error(`person: ${pErr.message}`);

  const { data: user, error: uErr } = await db
    .from('user')
    .insert({
      workspace_id: ws.id,
      person_id: person.id,
      email,
      full_name: 'New Organiser',
      primary_auth_method: 'magic_link',
      email_verified: true,
      is_super_admin: false, // a client, not an operator — that is the point
    })
    .select('id')
    .single();
  if (uErr) throw new Error(`user: ${uErr.message}`);
  await db.from('person').update({ user_id: user.id }).eq('id', person.id);

  const { error: wmErr } = await db.from('workspace_member').insert({
    workspace_id: ws.id,
    user_id: user.id,
    workspace_role: 'admin',
    relationship_type: 'internal',
  });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);

  // The plan's apps, the same set ensurePlanApps grants on a real sign-in,
  // plus platform admin for the workspace's first user.
  const { data: apps } = await db
    .from('app')
    .select('id, slug')
    .in('slug', ['fibre-platform', 'fibre-meet', 'the-thread']);
  const grants = [];
  for (const app of apps ?? []) {
    if (app.slug !== 'fibre-platform') {
      await db.from('workspace_app').insert({ workspace_id: ws.id, app_id: app.id });
    }
    grants.push({
      user_id: user.id,
      app_id: app.id,
      role: app.slug === 'fibre-platform' ? 'admin' : 'member',
    });
  }
  if (grants.length) {
    const { error } = await db
      .from('app_membership')
      .upsert(grants, { onConflict: 'user_id,app_id', ignoreDuplicates: true });
    if (error) throw new Error(`app_membership: ${error.message}`);
  }

  const { data: authUser, error: aErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: 'New Organiser' },
  });
  if (aErr) throw new Error(`auth account: ${aErr.message}`);

  const url = await mintSignIn(targetApp, authUser.user.id, email, next);
  const { data: sub } = await db
    .from('workspace_subscription')
    .select('plan_id, status')
    .eq('workspace_id', ws.id)
    .maybeSingle();

  console.log(`\nA brand-new organiser, with nothing behind them.\n`);
  console.log(`  workspace   ${wsName}  (${slug})`);
  console.log(`  email       ${email}`);
  console.log(`  plan        ${sub?.plan_id ?? '?'} / ${sub?.status ?? '?'}`);
  console.log(`  apps        ${(apps ?? []).map((a) => a.slug).join(', ')}`);
  console.log(`\nSign in as them (single use, 15 minutes):\n\n${url}\n`);
  console.log(`Come back later:  node scripts/cold-organiser.mjs --signin ${slug}`);
}

const targetApp = flag('app') || 'fibre-platform';
if (!HOSTS[targetApp]) {
  console.error(`--app must be one of: ${Object.keys(HOSTS).join(', ')}`);
  process.exit(1);
}
const next = flag('next') || '/dashboard';

try {
  if (args.includes('--list')) await list();
  else if (args.includes('--signin')) await signinExisting(flag('signin'), targetApp, next);
  else await create(flag('name'), targetApp, next);
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exit(1);
}
