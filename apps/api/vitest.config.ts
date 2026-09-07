import { defineConfig } from 'vitest/config';

// Unit tests import lib modules that transitively pull in src/db.ts, whose
// adminClient is constructed at module load and validates its URL. These
// placeholders keep the import safe; unit tests never talk to a database
// (integration tests will run against staging with real env — testing
// approach §3.4).
export default defineConfig({
  test: {
    // Integration tests live in src/integration (staging DB, their own
    // config + credentials) — the unit run must not touch them.
    exclude: ['**/node_modules/**', 'src/integration/**'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    },
  },
});
