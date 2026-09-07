import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Integration tests (testing approach §3.4): REAL Postgres + RLS on the
// STAGING project — never mocks (RLS is the enforcement layer; mocking it
// tests nothing) and never production. Credentials come from
// apps/api/.env.staging (gitignored, present on dev machines); the whole
// suite refuses to run without it rather than silently testing nothing.
//
// Rules of engagement (from the sessions that own the staging data):
// - The rehearsal workspace (Stripe test rig) is LOAD-BEARING — never
//   mutate or clean it; fixtures are throwaway rows cleaned by their own
//   ids/refs, never workspace-wide sweeps.
// - The staging API's real 5-minute scheduler runs against this database:
//   any member-ish fixture needs a far-future renews_at and an
//   @example.com address, and may still be touched within minutes.

function stagingEnv(): Record<string, string> {
  const file = resolve(import.meta.dirname, '.env.staging');
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `apps/api/.env.staging not found — integration tests run against the ` +
        `staging database and refuse to run without its credentials.`,
    );
  }
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

export default defineConfig({
  test: {
    include: ['src/integration/**/*.int.test.ts'],
    env: stagingEnv(),
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // The suite talks to one shared database — no parallel files.
    fileParallelism: false,
  },
});
