import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// NOTHING SENDS A MEMBER TO THE MEMBERS APP'S OWN `/my` ANY MORE.
//
// There were two personal pages for one person: `/my` in the Members app, and
// my.thread. The thinner one was winning, because it was the address the
// emails pointed at — Sjoerd landed on it from an invitation while testing on
// staging and wondered where everything had gone.
//
// `/my` is a redirect now, so a sent email and a stored Stripe success_url
// still work. But a NEW link pointing there would quietly reintroduce the
// hop, and the next person to add one will not have read any of this. Hence
// a test: it fails the moment somebody writes that address again.
//
// What is checked is the EMAIL TEMPLATES and the Members app's own pages,
// which is where every one of the old links lived.
// ---------------------------------------------------------------------------

const ROOT = new URL('../../../../..', import.meta.url).pathname;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** A link to the Members app's own member page, in the spellings that reach a
 *  person: an href, a template literal, or a bare string. The app's own
 *  redirect files are the one place the address is allowed to appear. */
const OFFENDING = [
  /href="\/my"/,
  /href=\{?['"`]\/my['"`]/,
  /MEMBERSHIP_APP_URL\}\/my\b/,
  /membership[a-z.]*\.(?:thethread\.app|thefibre\.tech)\/my\b/,
];

const ALLOWED_TO_MENTION_IT = [
  // The redirects themselves, and this test.
  'apps/membership/app/my/',
  'apps/membership/app/auth/callback/route.ts', // its public-prefix list
];

describe('links to the old member page', () => {
  const files = [
    ...walk(join(ROOT, 'apps/api/src/lib/email')),
    ...walk(join(ROOT, 'apps/membership/app')),
  ];

  it('finds the files it means to check', () => {
    // An empty sweep passes every assertion below it. Assert the sweep found
    // something, and something specific — a wrong ROOT would otherwise read
    // as a clean bill of health.
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.includes('membership-templates.ts'))).toBe(true);
    expect(files.some((f) => f.includes('apps/membership/app/my/page.tsx'))).toBe(true);
  });

  it('are gone from every email template and every Members page', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.slice(file.indexOf('apps/'));
      if (ALLOWED_TO_MENTION_IT.some((a) => rel.startsWith(a))) continue;
      const src = readFileSync(file, 'utf8');
      for (const pattern of OFFENDING) {
        if (pattern.test(src)) offenders.push(`${rel} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the welcome email points at the portal, not at this app', () => {
    const src = readFileSync(
      join(ROOT, 'apps/api/src/routes/membership.ts'),
      'utf8',
    );
    // Both triggers build the portal URL the same way, from the stack rather
    // than from a constant.
    const calls = src.match(/portalUrl:/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/stackSurfaceUrl\('my-portal', process\.env\)\}\/memberships/);
  });
});
