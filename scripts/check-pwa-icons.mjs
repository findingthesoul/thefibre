#!/usr/bin/env node
// An installable app whose icon file is missing is a blank tile in somebody's
// Dock, and nothing else goes wrong: the manifest is valid, the build is
// green, the page is perfect. The only place the mistake exists is between a
// path in a manifest and a file in `public/`.
//
// DERIVED ON BOTH SIDES, never listed. The apps are every `apps/*/app/
// manifest.ts` that exists, so an app that becomes installable is covered the
// moment it does; the paths are read out of `packages/shared/src/pwa.ts`,
// which is the single place they are declared, so this cannot drift from the
// thing it guards. `scripts/make-app-icons.sh` is what writes them.
//
// Sibling of check-sw-freshness.mjs, which guards the other half: a worker
// older than what it precaches. Connect's icon was wrong on real phones for
// days in September 2026, which is why both of these exist.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(ROOT, 'packages/shared/src/pwa.ts'), 'utf8');

/** Every `src: '/…'` and `url: '/…'` the shared module declares — the
 *  manifest's three icons and the apple-touch icon in the metadata. */
function declaredPaths() {
  const block = source.match(/export const PWA_ICONS = \[(.*?)\n\];/s);
  const icons = block ? [...block[1].matchAll(/src: '([^']+)'/g)].map((m) => m[1]) : [];
  const apple = [...source.matchAll(/url: '(\/apple-touch-icon[^']*)'/g)].map((m) => m[1]);
  return [...new Set([...icons, ...apple])];
}

const paths = declaredPaths();
const problems = [];

// A guard reading an empty list passes for the wrong reason.
if (paths.length < 4) {
  problems.push(
    `packages/shared/src/pwa.ts: found only ${paths.length} icon path(s) — expected the three ` +
      `manifest icons and apple-touch-icon. Has PWA_ICONS been renamed or reshaped?`,
  );
}

const installable = readdirSync(resolve(ROOT, 'apps')).filter((app) =>
  existsSync(resolve(ROOT, `apps/${app}/app/manifest.ts`)),
);
if (installable.length === 0) {
  problems.push('no apps/*/app/manifest.ts found at all — this check is looking in the wrong place');
}

for (const app of installable) {
  for (const p of paths) {
    if (!existsSync(resolve(ROOT, `apps/${app}/public${p}`))) {
      problems.push(
        `apps/${app}: declares a manifest but has no public${p} — ` +
          `run ./scripts/make-app-icons.sh ${app} <square source.png>`,
      );
    }
  }
}

if (problems.length) {
  console.error('PWA icons:\n' + problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `PWA icons: ${installable.length} installable app(s) — ${installable.join(', ')} — each has all ${paths.length} icon files.`,
);
