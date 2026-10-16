// Product groups in Members → Products: create, file a product by drag,
// reorder groups by drag, archive — each step asked of the DATABASE and seen
// again after a reload. A drag-and-drop page is where "it moved on screen"
// and "it was saved" part ways (feedback: a load is not a save).
//
// Signs in as the E2E FIXTURE admin, never a person; seeds its own products
// and removes everything it made, by id.

import { expect, test, type Page } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const TAG = `e2e-groups-${Date.now().toString(36)}`;
const A = `${TAG} A`;
const B = `${TAG} B`;
const P1 = `${TAG} p1`;
let workspaceId = '';
const productIds: string[] = [];

const db = () => stagingService();
async function poll<T>(read: () => Promise<T>, ok: (v: T) => boolean, what: string): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = await read();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`never saved: ${what}`);
}
const group = (name: string) =>
  db().from('membership_product_group').select('id, sort_order, archived_at').eq('workspace_id', workspaceId).eq('name', name).maybeSingle().then((r) => r.data);
const productGroup = async () =>
  (await db().from('membership_product').select('group_id').eq('id', productIds[0]!).single()).data?.group_id as string | null;
// Groups are labelled sections since 2026-10-16 (the name is text; a menu
// renames and archives).
const sectionOf = (page: Page, name: string) => page.locator(`section[data-group="${name}"]`);

async function open(page: Page) {
  await landSignedIn(page, HOSTS.membership, 'membership', '/products', /\/products|no-access/);
  await waitForHydration(page, 'button');
  await expect(page.getByText(P1).first()).toBeVisible();
}

test.beforeAll(async () => {
  workspaceId = (await fixtureIdentity()).workspaceId;
  const { data, error } = await db()
    .from('membership_product')
    .insert([
      { workspace_id: workspaceId, name: P1, price_cents: 1000, purchasable: true },
      { workspace_id: workspaceId, name: `${TAG} p2`, price_cents: 2000, purchasable: true },
    ])
    .select('id');
  if (error) throw new Error(`seed: ${error.message}`);
  for (const p of data!) productIds.push(p.id as string);
});

test.afterAll(async () => {
  await db().from('membership_product').delete().in('id', productIds);
  await db().from('membership_product_group').delete().eq('workspace_id', workspaceId).like('name', `${TAG}%`);
  const { count } = await db().from('membership_product_group').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).like('name', `${TAG}%`);
  expect(count).toBe(0);
});

test('create, file by drag, reorder by drag, archive — saved, and still so after a reload', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  // Create two groups (the field opens from the header button).
  for (const n of [A, B]) {
    await page.getByRole('button', { name: 'New product group' }).first().click();
    const nameBox = page.getByPlaceholder('Product group name');
    await nameBox.fill(n);
    await nameBox.press('Enter');
    await poll(() => group(n), (g) => !!g, `group ${n}`);
  }
  await expect(sectionOf(page, A)).toBeVisible();

  // File p1 into A by drag (onto A's empty drop area).
  // Only the handle drags (it is its own target since 2026-10-16).
  await page.getByRole('button', { name: `Move ${P1}` }).dragTo(sectionOf(page, A).getByText('Drop a product here'));
  const a = (await group(A))!;
  await poll(productGroup, (g) => g === a.id, 'p1 filed under A');
  await page.reload();
  await waitForHydration(page, 'button');
  await expect(sectionOf(page, A).getByText(P1)).toBeVisible();

  // Reorder: drag B's handle row onto A's section → B before A.
  const bHandle = sectionOf(page, B).getByRole('button', { name: `Move ${B}` });
  await bHandle.dragTo(sectionOf(page, A).getByRole('button', { name: `Move ${A}` }));
  await poll(
    async () => [await group(A), await group(B)],
    ([ga, gb]) => !!ga && !!gb && gb.sort_order < ga.sort_order,
    'B ordered before A',
  );
  await page.reload();
  await waitForHydration(page, 'button');
  const names = await page.locator('section[data-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')));
  expect(names.indexOf(B)).toBeLessThan(names.indexOf(A));

  // Archive A: the product stays, ungrouped.
  page.once('dialog', (d) => void d.accept());
  await sectionOf(page, A).getByRole('button', { name: 'Group options' }).click();
  await page.getByRole('menuitem', { name: 'Archive group' }).click();
  await poll(async () => [await group(A), await productGroup()] as const, ([ga, pg]) => !!ga?.archived_at && pg === null, 'A archived and p1 ungrouped');
  await page.reload();
  await waitForHydration(page, 'button');
  await expect(sectionOf(page, A)).toHaveCount(0);
  await expect(page.getByText(P1).first()).toBeVisible();
});
