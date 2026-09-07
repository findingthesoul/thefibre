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
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
