import { defineConfig } from 'vitest/config';

// Root-level runner for the repo SCRIPTS' tests only (scripts/ is not a
// workspace package, so `pnpm -r test` never reaches it). Package tests
// live in each package; `pnpm test` at the root runs both.
export default defineConfig({
  test: {
    include: ['scripts/*.test.mjs'],
  },
});
