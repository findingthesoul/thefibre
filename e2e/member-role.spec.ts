import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn, landSignedInAsMember } from './helpers.js';

// THE OTHER SIDE OF A ROLE BRANCH, looked at rather than reasoned about.
//
// On 2026-10-12 a question about Settings → Payments — does a NON-ADMIN see
// the workspace's own name on the second account? — was answered by reading
// the route: `GET /workspace-brand` has no role check, and `isAdmin` only
// decides the `editable` flag it reports. That is a correct argument, and an
// argument is not an observation; telling the two apart is the whole point of
// the browser pack (testing approach §1.5).
//
// It needed a non-admin who is nobody, which is what the MEMBER fixture is
// (e2e/identities.ts): the same workspace as the default fixture, the same
// app seats, `workspace_role: 'organiser'` instead of 'admin'. ONE column of
// difference, so whatever these two tests see differently IS the role.
//
// Both panels of that form stay MOUNTED with the inactive one hidden (the
// component says why: each holds unsaved edits), so these read the DOM
// rather than innerText — hidden text is still rendered text, and what is
// being checked is what the page contains for each role.
//
// Looks only. Nothing here presses a control that commits.

type Shape = { legalNames: number; saves: number; managed: boolean; namedTab: boolean };

async function shapeOf(page: import('@playwright/test').Page): Promise<Shape> {
  return page.evaluate(() => ({
    legalNames: Array.from(document.querySelectorAll('label, span')).filter((e) =>
      (e.textContent ?? '').includes('Legal name'),
    ).length,
    saves: Array.from(document.querySelectorAll('button')).filter(
      (e) => (e.textContent ?? '').trim() === 'Save',
    ).length,
    managed: (document.body.textContent ?? '').includes('Managed by workspace admins'),
    // The tab for the second account, named after the workspace rather than
    // "Workspace account" — the v1.159.0 fix, seen here by a non-admin.
    namedTab: Array.from(document.querySelectorAll('button')).some((e) =>
      (e.textContent ?? '').includes('Workspace of E2E fixtures'),
    ),
  }));
}

test.describe('Settings → Payments: admin and non-admin, same screen (v1.160.0)', () => {
  test('a member sees whose workspace account it is, and cannot edit it', async ({ page }) => {
    test.slow();
    await landSignedInAsMember(page, HOSTS.thread, 'the-thread', '/settings/payments', /payments/);
    const m = await shapeOf(page);

    // Named, not "Workspace account": a member is told whose account the
    // workspace's is. This is the answer the route reading only argued for.
    expect(m.namedTab, 'the second tab carries the workspace name').toBe(true);
    // Read-only, and SAID so: the workspace panel renders its note instead of
    // its fields, so there is exactly one Save on the page — the personal one.
    expect(m.managed, 'the workspace panel says who may change it').toBe(true);
    expect(m.saves, 'one Save: the personal account only').toBe(1);
  });

  test('the admin fixture, on the same screen, can edit it', async ({ page }) => {
    test.slow();
    // The control case: "disabled" means nothing without an enabled one
    // beside it, on the same workspace, with the same data.
    await landSignedIn(page, HOSTS.thread, 'the-thread', '/settings/payments', /payments/);
    const a = await shapeOf(page);

    expect(a.namedTab, 'the admin sees the same named tab').toBe(true);
    expect(a.managed, 'an admin is not told somebody else manages it').toBe(false);
    expect(a.saves, 'two Saves: personal and workspace').toBe(2);
    // Twice the fields of the member's page, which is the same fact counted
    // another way: the member gets one editable panel, the admin two.
    expect(a.legalNames).toBeGreaterThan(2);
  });
});

test.describe('what the member fixture may not open (v1.160.0)', () => {
  test('the platform invoices list is not theirs', async ({ page }) => {
    test.slow();
    // The default fixture is a platform super admin on staging; the member is
    // not, and the identity builder asserts that it is not one before
    // handing it over. So this is the one screen where the two must
    // disagree. (The column name is deliberately not written here: the
    // release gate forbids that string in any spec, which is how it catches
    // a spec that would GRANT it rather than read about it.)
    await landSignedInAsMember(
      page,
      HOSTS.fibre,
      'fibre-platform',
      '/admin/invoices',
      /admin|dashboard|no-access/,
    );
    await expect(page.locator('body')).not.toContainText(
      'E2E fixture: platform subscription (do not edit)',
    );
  });
});
