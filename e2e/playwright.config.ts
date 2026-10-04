import { defineConfig } from '@playwright/test';

// E2E golden paths (testing approach §3.5) — run against STAGING, never
// production. Kept ruthlessly small so the suite stays green and trusted.
// Sign-in uses the SSO-handoff landing route with a code minted straight
// into the staging DB (see helpers.ts) — no OTP inbox, no Google
// automation, and it exercises the same session machinery real users get.
//
// Run: pnpm test:e2e   (needs apps/api/.env.staging for the mint helper)

export default defineConfig({
  testDir: '.',
  timeout: 45_000,
  retries: 1,
  workers: 2,
  use: {
    baseURL: 'https://thefibre.tech',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
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
  ],
});
