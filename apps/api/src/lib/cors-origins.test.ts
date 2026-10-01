// The CORS lists, each held against the thing it is supposed to follow.
//
// Both lists in this module went stale while they lived untested in
// server.ts: a new app's dev port was never added, and PUT was missing from
// the allowed methods while routes were registered with it. Neither failure
// logs anything on the server — the browser refuses the preflight and the
// page just does not work. So the tests read the other side from disk.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_IDS, appUrl, stagingAppUrl, stagingSurfaceUrl, SURFACES, surfaceUrl, type SurfaceKey } from '@thefibre/shared';
import { buildOriginCheck, CORS_ALLOW_METHODS } from './cors-origins.js';

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const SURFACE_KEYS = Object.keys(SURFACES) as SurfaceKey[];

const production = buildOriginCheck({ FLY_APP_NAME: 'thefibre-api' });
const staging = buildOriginCheck({ FLY_APP_NAME: 'thefibre-api-staging' });

describe('allowed origins', () => {
  it('production allows every app and every surface at its production address', () => {
    for (const slug of APP_IDS) expect(production(appUrl(slug)), slug).toBe(true);
    for (const k of SURFACE_KEYS) expect(production(surfaceUrl(k)), k).toBe(true);
  });

  it('staging allows every app AND every surface at its staging address', () => {
    for (const slug of APP_IDS) expect(staging(stagingAppUrl(slug)), slug).toBe(true);
    // The portal on staging used to be allowed only by a hand-written secret.
    for (const k of SURFACE_KEYS) expect(staging(stagingSurfaceUrl(k)), k).toBe(true);
  });

  it('production does NOT allow a staging page', () => {
    const stagingOnly = [
      ...APP_IDS.map((slug) => stagingAppUrl(slug)),
      ...SURFACE_KEYS.map((k) => stagingSurfaceUrl(k)),
    ];
    // Guard the guard: a registry where staging and production share an
    // address would make this test pass by having nothing to refuse.
    expect(stagingOnly.length).toBeGreaterThan(5);
    for (const origin of stagingOnly) expect(production(origin), origin).toBe(false);
  });

  it('refuses a stranger, a look-alike host and a non-https copy of ours', () => {
    for (const origin of [
      'https://example.com',
      'https://thethread.app.example.com',
      'https://evil-thethread.app',
      'http://app.thethread.app',
      'https://someone-else.vercel.app',
      'http://localhost:8080',
      'http://localhost:30000',
      'https://localhost:3000',
      '',
    ]) {
      expect(production(origin), origin).toBe(false);
      expect(staging(origin), origin).toBe(false);
    }
  });

  it('CORS_ORIGINS adds exactly what it names', () => {
    const check = buildOriginCheck({ CORS_ORIGINS: ' https://one.example , https://two.example ,' });
    expect(check('https://one.example')).toBe(true);
    expect(check('https://two.example')).toBe(true);
    expect(check('https://three.example')).toBe(false);
  });

  it("allows every app's dev port — read from each apps/*/package.json", () => {
    const appsDir = path('../../../');
    const ports: { app: string; port: string }[] = [];
    for (const app of readdirSync(appsDir, { withFileTypes: true })) {
      if (!app.isDirectory()) continue;
      let pkg: { scripts?: Record<string, string> };
      try {
        pkg = JSON.parse(readFileSync(`${appsDir}${app.name}/package.json`, 'utf8'));
      } catch {
        continue; // not a package
      }
      const m = /next dev -p (\d+)/.exec(pkg.scripts?.dev ?? '');
      if (m) ports.push({ app: app.name, port: m[1]! });
    }
    // Ten Next apps today. If this finds few, the reader broke, not the list.
    expect(ports.length).toBeGreaterThanOrEqual(10);
    for (const { app, port } of ports) {
      expect(production(`http://localhost:${port}`), `${app} on :${port}`).toBe(true);
    }
  });
});

describe('allowed methods', () => {
  it('cover every verb a route is registered with', () => {
    const routesDir = path('../routes/');
    const used = new Map<string, string>(); // VERB → first file seen
    for (const file of readdirSync(routesDir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(`${routesDir}${file}`, 'utf8');
      for (const m of source.matchAll(/\b\w*[Rr]outes\.(get|post|put|patch|delete)\(/g)) {
        const verb = m[1]!.toUpperCase();
        if (!used.has(verb)) used.set(verb, file);
      }
    }
    // All five are in use today; finding fewer means the pattern stopped matching.
    expect([...used.keys()].sort()).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT']);
    for (const [verb, file] of used) {
      expect(CORS_ALLOW_METHODS, `${verb} is used in routes/${file}`).toContain(verb);
    }
    expect(CORS_ALLOW_METHODS).toContain('OPTIONS');
  });
});
