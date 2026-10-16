// Members → Products as ROWS (2026-10-16, Sjoerd: denser rows, Unlocks as
// icons, a labelled group menu), on STAGING as the FIXTURE admin.
//
// Seeds its own group and three products — one that unlocks five things and
// carries five characteristics, one renewing, one with no price — and removes
// all of it by id afterwards. So it is repeatable on the empty fixture
// workspace, and it is what the screenshots for Sjoerd are taken from.
//
// Checks: one row per product; at most four Unlocks then "+N more", with the
// full list in the tooltip; the "what it is" line cut at three
// characteristics with "+N"; the drag handle is its own target (dragging it
// opens no dialog, clicking the row does); the group menu renames and
// archives, asked of the DATABASE.

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const TAG = `e2e-rows-${Date.now().toString(36)}`;
const GROUP = `${TAG} Pathways`;
const P1 = `${TAG} Fellowship pathway`;
const P2 = `${TAG} Community email`;
const P3 = `${TAG} Quarterly call`;
const SHOTS = process.env.E2E_SHOTS;
// A local dev server against the staging API can stand in for staging, so the
// screenshots exist BEFORE a release (E2E_MEMBERSHIP_HOST=http://localhost:3015).
const HOST = process.env.E2E_MEMBERSHIP_HOST ?? HOSTS.membership;
let workspaceId = '';
let groupId = '';
const productIds: string[] = [];
const db = () => stagingService();

test.beforeAll(async () => {
  workspaceId = (await fixtureIdentity()).workspaceId;
  const g = await db().from('membership_product_group').insert({ workspace_id: workspaceId, name: GROUP, sort_order: 0 }).select('id').single();
  if (g.error) throw new Error(`seed group: ${g.error.message}`);
  groupId = g.data.id as string;
  const rows = [
    {
      workspace_id: workspaceId, name: P1, group_id: groupId, sort_order: 0, price_cents: 50000, price_interval: 'year', purchasable: true,
      description: 'A year-long path through the Fellowship',
      characteristics: ['Monthly circle', 'Mentor', 'Retreat', 'Library', 'Certificate'],
      links: [{ kind: 'url', ref: 'https://example.org/fellowship', label: 'Programme page' }],
    },
    { workspace_id: workspaceId, name: P2, group_id: groupId, sort_order: 10, price_cents: 6000, price_interval: 'year', purchasable: true, description: 'Your own address in the community', characteristics: ['Inbox', 'Calendar'] },
    { workspace_id: workspaceId, name: P3, sort_order: 20, description: 'Four calls a year, included in a tier' },
  ];
  for (const r of rows) {
    const { data, error } = await db().from('membership_product').insert(r).select('id').single();
    if (error) throw new Error(`seed product: ${error.message}`);
    productIds.push(data.id as string);
  }
  const grants = [
    { kind: 'circle', config: { space_id: 'e2e-space' } },
    { kind: 'thread', config: { thread_slug: `${TAG}-nothread` } },
    { kind: 'fibre_seat', config: {} },
    { kind: 'google_user', config: {} },
  ].map((x) => ({ workspace_id: workspaceId, product_id: productIds[0], tier_id: null, ...x }));
  const { error } = await db().from('membership_access_grant').insert(grants);
  if (error) throw new Error(`seed grants: ${error.message}`);
  const g2 = await db().from('membership_access_grant').insert({ workspace_id: workspaceId, product_id: productIds[1], tier_id: null, kind: 'google_user', config: {} });
  if (g2.error) throw new Error(`seed grant 2: ${g2.error.message}`);
});

test.afterAll(async () => {
  await db().from('membership_access_grant').delete().in('product_id', productIds);
  await db().from('membership_product').delete().in('id', productIds);
  await db().from('membership_product_group').delete().eq('workspace_id', workspaceId).like('name', `${TAG}%`);
  const left = await db().from('membership_product').select('id', { count: 'exact', head: true }).in('id', productIds);
  expect(left.count).toBe(0);
});

/** A LOCAL dev server cannot redeem the hosted sign-in hop (it needs the
 *  staging SSO secret), so the FIXTURE's session is made server-side with
 *  verifyOtp and planted as the Supabase auth cookie — base64-prefixed JSON,
 *  chunked at 3180 characters (docs/connections-handover.md §7). Fixture
 *  only, never a person. */
async function plantFixtureSession(page: Page) {
  const env = Object.fromEntries(
    readFileSync(resolve(process.cwd(), 'apps/api/.env.staging'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  const { email } = await fixtureIdentity();
  const link = await db().auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw new Error(`e2e: generateLink: ${link.error.message}`);
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const v = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
  if (v.error || !v.data.session) throw new Error(`e2e: verifyOtp: ${v.error?.message ?? 'no session'}`);
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
  const value = 'base64-' + Buffer.from(JSON.stringify(v.data.session)).toString('base64url');
  const name = `sb-${ref}-auth-token`;
  const chunks = value.match(/.{1,3180}/g)!;
  const url = new URL(HOST);
  await page.context().addCookies(
    (chunks.length === 1 ? [{ name, value }] : chunks.map((c, i) => ({ name: `${name}.${i}`, value: c }))).map((c) => ({ ...c, domain: url.hostname, path: '/' })),
  );
  await page.goto(`${HOST}/products`);
}

async function open(page: Page) {
  if (/localhost|127\.0\.0\.1/.test(HOST)) await plantFixtureSession(page);
  else await landSignedIn(page, HOST, 'membership', '/products', /\/products|no-access/);
  await waitForHydration(page, 'button');
  await expect(page.locator(`li[data-product="${P1}"]`)).toBeVisible({ timeout: 30_000 });
}

test('rows, unlocks, traits, and a drag handle that is its own target', async ({ page }) => {
  test.setTimeout(150_000);
  await open(page);
  for (const name of [P1, P2, P3]) await expect(page.locator(`li[data-product="${name}"]`)).toHaveCount(1);

  const row = page.locator(`li[data-product="${P1}"]`);
  const unlocks = row.getByLabel('Unlocks');
  // 4 grants + 1 link = 5 → four shown, "+1 more" carrying the rest.
  await expect(unlocks.locator('> span[title]')).toHaveCount(5);
  await expect(unlocks.getByText('+1 more')).toBeVisible();
  await expect(unlocks.getByText('+1 more')).toHaveAttribute('title', 'Programme page');
  await expect(row.getByText('A year-long path through the Fellowship · Monthly circle · Mentor · Retreat · +2')).toBeVisible();

  // The handle drags without opening the dialog…
  await row.getByRole('button', { name: `Move ${P1}` }).dragTo(page.locator(`li[data-product="${P2}"]`));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // …and a click on the row opens it.
  await page.locator(`li[data-product="${P2}"]`).getByText(P2).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  if (SHOTS) {
    await page.reload();
    await expect(page.locator(`li[data-product="${P1}"]`)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/products-rows-1280.png` });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/products-rows-375.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
  }
});

test('the labelled group menu renames and archives', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  const section = page.locator(`section[data-group="${GROUP}"]`);
  await section.getByRole('button', { name: 'Group options' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const box = section.getByRole('textbox');
  await box.fill(`${GROUP} renamed`);
  await box.press('Enter');
  await expect.poll(async () => (await db().from('membership_product_group').select('name').eq('id', groupId).single()).data?.name, { timeout: 20_000 }).toBe(`${GROUP} renamed`);

  const renamed = page.locator(`section[data-group="${GROUP} renamed"]`);
  page.once('dialog', (d) => void d.accept());
  await renamed.getByRole('button', { name: 'Group options' }).click();
  await page.getByRole('menuitem', { name: 'Archive group' }).click();
  await expect.poll(async () => (await db().from('membership_product_group').select('archived_at').eq('id', groupId).single()).data?.archived_at, { timeout: 20_000 }).not.toBeNull();
});
