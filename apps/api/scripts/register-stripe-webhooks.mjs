#!/usr/bin/env node
// Make a Stripe project's webhook endpoints match what the API answers —
// the fixing half of verify-stripe-webhooks.mjs.
//
// For each endpoint in scripts/lib/stripe-webhooks.mjs, on the API host you
// name: if one exists in the right mode with every needed event, it is left
// alone. Otherwise the wrong one is deleted and a correct one created, and
// the new signing secret goes straight into the Fly app's secrets — never to
// the terminal, never to a file. Stripe shows a signing secret once, at
// creation, which is why the deletion and the secret push happen in the same
// run: an endpoint recreated by hand in the dashboard without its secret
// pushed leaves payments worse off than before (the 09-12 note).
//
// Born 2026-09-14 for staging, whose three connected-account endpoints the
// verifier reported in platform-account mode. (That report turned out to
// read a field Stripe never returns — see isConnectEndpoint — so they may
// have been right all along; they were recreated before that was known, and
// are certainly right now.) Stripe fixes the mode at creation, so the fix
// for a genuinely wrong one is delete-and-create, which is what this does.
//
// DRY RUN by default: prints what it would do. `--apply` does it.
//
// Usage:
//   FIBRE_ENV_FILE=.env.staging node scripts/register-stripe-webhooks.mjs \
//     --api https://thefibre-api-staging.fly.dev --fly-app thefibre-api-staging
//   …then add --apply.
//
// The key comes from the env file (STRIPE_SECRET_KEY) or the environment; a
// TEST key touches only test-mode endpoints. It refuses a LIVE key without
// --live, so pointing it at production is a decision, not an accident.

import { spawnSync } from 'node:child_process';
import { loadEnv } from './lib/env.mjs';
import { EXPECTED, isConnectEndpoint, modeOf, stripeClient } from './lib/stripe-webhooks.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};
const flag = (name) => process.argv.includes(`--${name}`);

let fileEnv = {};
try {
  fileEnv = loadEnv().env;
} catch {
  /* a key in the environment is enough */
}
const KEY = process.env.STRIPE_SECRET_KEY ?? fileEnv.STRIPE_SECRET_KEY;
const API = (arg('api') ?? '').replace(/\/$/, '');
const FLY_APP = arg('fly-app');
const APPLY = flag('apply');

if (!KEY) {
  console.error('No STRIPE_SECRET_KEY in the env file or the environment.');
  process.exit(2);
}
if (!API || !/^https:\/\//.test(API)) {
  console.error('Pass --api https://<the API host Stripe should call>.');
  process.exit(2);
}
if (!FLY_APP) {
  console.error('Pass --fly-app <name>: the signing secrets go there and nowhere else.');
  process.exit(2);
}
const mode = modeOf(KEY);
if (mode === 'LIVE' && !flag('live')) {
  console.error('This is a LIVE key. Pass --live if you really mean production.');
  process.exit(2);
}

const stripe = stripeClient(KEY);
const apiHost = new URL(API).host;
console.log(`Stripe ${mode} mode → endpoints on ${apiHost}, secrets to Fly app ${FLY_APP}`);
console.log(APPLY ? 'APPLYING.\n' : 'Dry run — add --apply to change anything.\n');

const { data: endpoints } = await stripe('webhook_endpoints?limit=100');
const secrets = {};
let changed = 0;

for (const want of EXPECTED) {
  const url = `${API}${want.path}`;
  const here = endpoints.filter((e) => e.url === url);
  const good = here.find(
    (e) =>
      e.status === 'enabled' &&
      isConnectEndpoint(e) === want.connect &&
      (e.enabled_events.includes('*') || want.events.every((ev) => e.enabled_events.includes(ev))),
  );
  if (good) {
    console.log(`  · ${want.path} — already right (${good.id})`);
    continue;
  }
  changed += 1;
  for (const e of here) {
    console.log(`  ✗ ${want.path} — delete ${e.id} (${isConnectEndpoint(e) ? 'connected' : 'platform'} mode, ${e.enabled_events.length} events)`);
    if (APPLY) await stripe(`webhook_endpoints/${e.id}`, { method: 'DELETE' });
  }
  console.log(
    `  + ${want.path} — create in ${want.connect ? 'connected-account' : 'platform-account'} mode with ${want.events.length} events → ${want.secretEnv}`,
  );
  if (APPLY) {
    const created = await stripe('webhook_endpoints', {
      method: 'POST',
      body: {
        url,
        enabled_events: want.events,
        connect: want.connect,
        description: `The Fibre — ${want.why}`,
      },
    });
    secrets[want.secretEnv] = created.secret;
  }
}

if (!changed) {
  console.log('\nNothing to do: every endpoint is registered in the right mode with every event.');
  process.exit(0);
}
if (!APPLY) {
  console.log(`\n${changed} endpoint(s) would change. Re-run with --apply.`);
  process.exit(0);
}

// The secrets never touch argv (visible in `ps`) or a file: `fly secrets
// import` reads KEY=VALUE lines from stdin.
const lines = Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
const r = spawnSync('fly', ['secrets', 'import', '-a', FLY_APP], { input: lines, encoding: 'utf8' });
if (r.status !== 0) {
  console.error(`\nfly secrets import failed (${r.status}):\n${r.stderr || r.stdout}`);
  console.error(
    `The endpoints ARE created; their secrets are ${Object.keys(secrets).join(', ')} and exist only in this process. ` +
      `Re-run the whole script after fixing fly access (it will recreate them and push again).`,
  );
  process.exit(1);
}
console.log(`\n${Object.keys(secrets).length} secret(s) set on ${FLY_APP}: ${Object.keys(secrets).join(', ')}`);
console.log('Fly restarts the machines with the new secrets. Verify with verify-stripe-webhooks.mjs.');
