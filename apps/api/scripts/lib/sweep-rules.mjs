// What the staging sweep may touch, and what it must never touch.
//
// Split out of sweep-leaked-test-workspaces.mjs so the rules can be tested
// without a database (scripts/sweep-rules.test.mjs, run by `pnpm verify`).
// The script that deletes is a thin reader of these.

/** OPT-IN: a workspace is swept only if its slug matches one of these AND its
 *  name is the one that harness writes. Nothing else is ever a candidate. */
export const HARNESS = [
  // Tags are mostly lower-case; two early ones were `rlsA` / `rlsB`.
  { label: 'int-test-*', slug: /^int-test-[A-Za-z0-9-]+-[0-9a-f]{8}$/, name: /^Integration test /, source: 'apps/api/src/integration/staging.ts createThrowawayWorkspace' },
  { label: 'e2e-noaccess-*', slug: /^e2e-noaccess-[0-9a-f]{8}$/, name: /^e2e no-access [AB] [0-9a-f]{6}$/, source: 'e2e/no-access.spec.ts makeFixture' },
  { label: 'first-admin-*', slug: /^first-admin-[0-9]{13}$/, name: /^First admin fixture$/, source: 'apps/api/src/integration/workspace-first-admin.int.test.ts' },
];

/** Must EXIST (or this is the wrong database) and must NEVER match a pattern. */
export const PERMANENT_WORKSPACES = [
  'int-enrol-fixtures',
  'int-public-fixtures',
  'int-merge-fixtures',
  'e2e-enrol-fixtures',
  // The browser pack's own account lives here (e2e/identities.ts). Sweep it
  // and every signed-in spec signs in as nobody.
  'e2e-fixtures',
];

/** Sign-in identities that are fixtures on purpose. Never "orphans", whatever
 *  a count of @example.com addresses says. */
export const PERMANENT_ACCOUNTS = ['e2e-fixture@example.com', 'fixture-organiser@example.com'];

/** The Stripe rehearsal workspace, by the start of its id. */
export const REHEARSAL_PREFIX = 'ca0569d5';

/**
 * Sort every workspace into: to sweep, slug-matched-but-wrongly-named (left,
 * listed), permanent ones found, permanent ones MISSING, and permanent ones
 * a pattern matched (which means the patterns are wrong). Pure.
 */
export function classify(workspaces) {
  const permanentFound = workspaces.filter((w) => PERMANENT_WORKSPACES.includes(w.slug));
  const missing = PERMANENT_WORKSPACES.filter((s) => !permanentFound.some((w) => w.slug === s));
  const rehearsal = workspaces.find((w) => String(w.id).startsWith(REHEARSAL_PREFIX)) ?? null;
  const candidates = [];
  const nameMismatch = [];
  const illegal = [];
  for (const w of workspaces) {
    const rule = HARNESS.find((h) => h.slug.test(w.slug));
    if (!rule) continue;
    if (PERMANENT_WORKSPACES.includes(w.slug) || (rehearsal && w.id === rehearsal.id)) {
      illegal.push(w);
      continue;
    }
    if (!rule.name.test(w.name ?? '')) nameMismatch.push({ ...w, label: rule.label });
    else candidates.push({ ...w, label: rule.label });
  }
  return { candidates, nameMismatch, permanentFound, missing, illegal, rehearsal };
}

/** Is this address an orphan test identity? Only @example.com, with no seat,
 *  and not one of the permanent fixture accounts. */
export function isOrphanTestAccount(email, seatEmails) {
  const e = String(email ?? '').toLowerCase();
  return e.endsWith('@example.com') && !seatEmails.has(e) && !PERMANENT_ACCOUNTS.includes(e);
}
