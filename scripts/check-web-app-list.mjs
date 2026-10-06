#!/usr/bin/env node
// The web layer keeps its own list of apps, and it went stale. This refuses a
// release where it is missing one.
//
// WHAT HAPPENED, 2026-10-06. Sjoerd, in Festival of Trust, with Models switched
// on and seven models already made in it: the member dialog listed Meet,
// Thread, Flow, Pulse, Membership and Connect, and no Models — so nobody could
// be granted the app from the screen whose job is granting apps. The profile
// tabs on every contact and organisation had the same hole.
//
// Nothing was broken in activation or in the API. `workspace_app` said Models
// was on; `grantableSlugs()` in routes/members.ts asks the catalogue and
// included it. The screens then filtered that correct answer through
// `APP_ORDER` in apps/web/lib/apps.ts — a hand-written list that had never
// heard of Models. An app can be activated, granted and used, and still be
// invisible on the screens that manage it.
//
// This is the allow-list rule from v0.14.0, which CLAUDE.md states outright:
// "Never re-add a slug allow-list. If you're tempted to hardcode which apps
// exist anywhere — SQL, API, or a web page — that's the bug this release
// removed. Ask the catalogue." routes/members.ts carries a comment saying it
// WAS exactly this bug, with Pulse and Membership missing. It was fixed in the
// API and left in the web layer, where it waited for the next app.
//
// WHY A CHECK RATHER THAN DELETING THE LIST. apps/web/lib/apps.ts does a second
// job the shared registry does not: it records which curator sub-resources each
// app owns on a person and an organisation, which is what builds the profile
// tabs. So the file stays; what must not happen again is it falling behind
// silently. Adding an app to the shared registry now fails the release until
// the web list knows about it too.
//
// It lives here, in the verify chain, because apps/web has NO test script — a
// test written beside that file would never run, which is its own trap and the
// reason this is a script rather than a unit test.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Slugs in a `[ 'a', 'b' ]` array literal assigned to `name`. */
function slugsInArray(source, name) {
  const m = source.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`could not find ${name} — has it been renamed or reshaped?`);
  return [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]);
}

const shared = readFileSync(resolve(ROOT, 'packages/shared/src/branding.ts'), 'utf8');
const web = readFileSync(resolve(ROOT, 'apps/web/lib/apps.ts'), 'utf8');

const known = slugsInArray(shared, 'APP_DISPLAY_ORDER');
const inWebOrder = slugsInArray(web, 'APP_ORDER');

// The APPS record and the AppSlug union matter too: a slug in APP_ORDER that
// has no entry renders a tab with no label, and one missing from the union is
// a type error nobody sees until they touch the file.
const missingFromOrder = known.filter((s) => !inWebOrder.includes(s));
const missingFromRecord = known.filter((s) => !new RegExp(`'${s}':\\s*\\{`).test(web));
const missingFromUnion = known.filter((s) => !new RegExp(`\\|\\s*'${s}'`).test(web));

const problems = [];
if (missingFromOrder.length) problems.push(['APP_ORDER', missingFromOrder]);
if (missingFromRecord.length) problems.push(['the APPS record', missingFromRecord]);
if (missingFromUnion.length) problems.push(['the AppSlug union', missingFromUnion]);

if (problems.length) {
  console.error('\napps/web/lib/apps.ts has fallen behind the app registry.\n');
  for (const [where, slugs] of problems) {
    console.error(`  missing from ${where}: ${slugs.join(', ')}`);
  }
  console.error(
    '\nThese screens filter the catalogue through that file, so an app missing\n' +
      'here is invisible on Settings → Members and on every profile tab, even\n' +
      'when the workspace has it switched on and people are using it. That is\n' +
      'how Models was ungrantable in a workspace holding seven models.\n',
  );
  process.exit(1);
}

// Printed on success so the chain shows what it actually checked, not just a
// silent pass.
console.log(`  ok   apps/web knows all ${known.length} registered apps`);
