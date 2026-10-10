import { defineConfig } from 'vitest/config';

// Root-level runner for the repo SCRIPTS' tests only (scripts/ is not a
// workspace package, so `pnpm -r test` never reaches it). Package tests
// live in each package; `pnpm test` at the root runs both.
export default defineConfig({
  test: {
    include: ['scripts/*.test.mjs'],
    // Every test this runner reaches SPAWNS PROCESSES — a sandbox git repo,
    // then release.sh / deploy-api.sh / next-version.mjs inside it. Vitest's
    // default is 5000ms, which is a sensible limit for a unit test and a coin
    // flip for one that shells out: on an idle machine these finish in a
    // couple of seconds, and on a busy one the same test takes minutes
    // without anything being wrong.
    //
    // That cost three releases of one inert commit on 2026-10-10
    // (docs/testing-approach.md §6). The failures moved around — connections
    // twice, then four of these four scripts tests — and were never an
    // assertion, always `Test timed out in 5000ms`. A gate that fails
    // randomly is worse than no gate, because people learn to re-run it.
    //
    // This does not rescue a machine at load average 36; nothing does, and
    // the stale dev servers that caused that are a separate problem. What it
    // removes is the coin flip at ordinary load: a busy machine now gives a
    // SLOW gate rather than a random one, and a test that genuinely hangs
    // still fails — three minutes, not forever.
    testTimeout: 180_000,
  },
});
