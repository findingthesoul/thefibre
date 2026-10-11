import { defineConfig } from 'vitest/config';

// The shared package's tests.
//
// Most of them are pure functions and need nothing. The ones that RENDER —
// ui/dialog.test.tsx and whatever follows it — need two things the defaults
// do not give, both learned next door in apps/connections/vitest.config.ts:
//
//   * the automatic JSX runtime, because this package's tsconfig says
//     `preserve` (the apps compile JSX themselves) and a test that renders a
//     component needs something to turn JSX into calls;
//   * `oxc`, NOT `esbuild`: Vite 8 transforms with oxc and an `esbuild.jsx`
//     setting is silently ignored, which fails on raw JSX with a message
//     pointing nowhere near the config.
//
// jsdom is per-file (`// @vitest-environment jsdom`) rather than global: the
// pure tests are the overwhelming majority and should not each pay for a DOM.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    exclude: ['**/node_modules/**', 'dist/**'],
  },
});
