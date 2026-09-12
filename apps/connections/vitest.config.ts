import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Connections' unit tests.
//
// Two things the defaults do not give us. The `@/` alias, which every app
// module imports through and which Next resolves but vitest does not. And the
// automatic JSX runtime, because the app's tsconfig says `preserve` (Next
// compiles JSX itself) and a test that renders a component needs something to
// actually turn JSX into calls.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  // `oxc`, not `esbuild`: Vite 8 transforms with oxc, and an `esbuild.jsx`
  // setting is silently ignored — the first run of the popup test failed on
  // raw JSX with the tsconfig's `preserve` still in force.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    exclude: ['**/node_modules/**', '.next/**'],
  },
});
