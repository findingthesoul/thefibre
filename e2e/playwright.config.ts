import { defineConfig } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// E2E golden paths (testing approach §3.5) — run against STAGING, never
// production. Kept ruthlessly small so the suite stays green and trusted.
// Sign-in uses the SSO-handoff landing route with a code minted straight
// into the staging DB (see helpers.ts) — no OTP inbox, no Google
// automation, and it exercises the same session machinery real users get.
//
// Run: pnpm test:e2e   (needs apps/api/.env.staging for the mint helper)

// ---------------------------------------------------------------------------
// OWNER SPECS ARE OPT-IN (Sjoerd, 2026-10-12: "owner tests opt-in")
// ---------------------------------------------------------------------------
// Three specs need the `default` workspace's real data and sign in as its
// owner — which on staging is SJOERD'S OWN ACCOUNT (e2e/identities.ts:
// resolveOwnerIdentity refuses to resolve to the fixture, so the identity is
// a person by design). A plain `pnpm test:e2e` ran them like everything else,
// so a builder chasing a flake minted dozens of sessions as him without ever
// deciding to. Counted on 2026-10-12: 42 handoff rows for his account in
// twenty-four hours, 697 in all.
//
// THE LIST IS ASKED OF THE SPECS, never kept here. Any spec that reaches the
// owner path — resolveOwnerIdentity, ownerLandUrl, landSignedInAsOwner — is
// excluded unless E2E_OWNER=1, so a FOURTH owner spec is opt-in the moment it
// is written, with nobody having to remember it.
//
// Ignored at FILE level on purpose, not skipped per test: a `beforeAll` runs
// before any test body can skip itself, and organiser-screens' hook writes a
// fixture row into his workspace. The file has to stay unloaded.
//
// And it says so out loud, because a quiet exclusion reads like a pass.
const OWNER_CALL = /\b(resolveOwnerIdentity|ownerLandUrl|landSignedInAsOwner)\b/;
const ownerOptIn = process.env.E2E_OWNER === '1';
const ownerSpecs = readdirSync(__dirname)
  .filter((f) => f.endsWith('.spec.ts'))
  .filter((f) => OWNER_CALL.test(readFileSync(join(__dirname, f), 'utf8')));
if (ownerSpecs.length && !ownerOptIn) {
  console.log(
    `\ne2e: NOT RUNNING ${ownerSpecs.length} owner spec(s) - they sign in as a real person's account.\n` +
      ownerSpecs.map((f) => `     - ${f}`).join('\n') +
      `\n     Set E2E_OWNER=1 to run them. An excluded owner spec proves nothing.\n`,
  );
}

/** Specs that flip shared fixture state; see the 'exclusive' project. */
const EXCLUSIVE = /(price-includes-vat|member-page-tiers|portal-files|member-addon)\.spec\.ts/;

export default defineConfig({
  testDir: '.',
  testIgnore: ownerOptIn ? [] : ownerSpecs,
  timeout: 45_000,
  retries: 1,
  workers: 2,
  use: {
    baseURL: 'https://thefibre.tech',
    trace: 'retain-on-failure',
  },
  projects: [
    // Specs that change SHARED fixture state for their run (e.g. making the
    // fixture workspace VAT-registered) are kept out of the parallel pool
    // and run alone, after it — so no other spec reads that state mid-flip.
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: EXCLUSIVE },
    // Safari, because Sjoerd uses Safari — every screenshot he sends is one —
    // and because the only place browsers genuinely disagree here is text
    // editing: a contenteditable is wrapped differently by each engine, which
    // is exactly what produced the bio-save bug (v1.101.3). Asked on
    // 2026-10-04 whether Safari should be checked every time, he said yes.
    //
    // Scoped to the editor and bio specs rather than the whole suite: running
    // everything twice doubles the runtime for pages where no engine differs,
    // and a suite people stop waiting for is a suite people stop running.
    // Widen this list when a spec covers something engine-dependent.
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
      testMatch: /profile-(bio-save|editor|limits)\.spec\.ts/,
    },
    {
      name: 'exclusive',
      use: { browserName: 'chromium' },
      testMatch: EXCLUSIVE,
      // Runs only after both projects above have finished: nothing else is
      // running while it flips the shared fixture.
      dependencies: ['chromium', 'webkit'],
    },
  ],
});
