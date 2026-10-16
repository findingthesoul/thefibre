// The public JOIN PAGE layout (Sjoerd, 2026-10-17), on STAGING data as the
// FIXTURE community — public, no sign-in:
//   · the price stands alone on its line; "per year · excl. VAT" sits BELOW it;
//   · every card has the same width in ONE left-aligned grid, so a group with
//     a single card puts it exactly where the first card of a full row is —
//     "Not these centered boxes"; group headings are left-aligned.
// Seeds two visible tiers and two product groups (Pathways ×3, Tools ×1) and
// switches the community's VAT on; everything is restored by value or removed
// by id, and read back. Exclusive project: it sets the community's VAT.
// E2E_MEMBERSHIP_HOST points it at a local Members app so screenshots exist
// before a release.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, stagingService } from './helpers.js';

const STAMP = Date.now().toString(36);
const HOST = process.env.E2E_MEMBERSHIP_HOST ?? HOSTS.membership;
const SHOTS = process.env.E2E_SHOTS ?? '';
let workspaceId = '';
let slug = '';
let invoiceBefore: unknown = null;
const tierIds: string[] = [];
const productIds: string[] = [];
const groupIds: string[] = [];
const db = () => stagingService();
const G1 = `Pathways ${STAMP}`;
const G2 = `Tools ${STAMP}`;

test.beforeAll(async () => {
  workspaceId = (await fixtureIdentity()).workspaceId;
  const { data: ws } = await db().from('workspace').select('slug, invoice_details').eq('id', workspaceId).single();
  slug = ws!.slug as string;
  invoiceBefore = ws!.invoice_details ?? null;
  const details = { ...((invoiceBefore as Record<string, unknown> | null) ?? {}), vat_registered: true, vat_rate_pct: 21 };
  const u = await db().from('workspace').update({ invoice_details: details }).eq('id', workspaceId);
  if (u.error) throw new Error(`vat on: ${u.error.message}`);

  const t = await db()
    .from('membership_tier')
    .insert([
      { workspace_id: workspaceId, name: `E2E Member ${STAMP}`, price_cents_year: 20000, hidden: false, sort_order: 900 },
      { workspace_id: workspaceId, name: `E2E Patron ${STAMP}`, price_cents_year: 60000, hidden: false, sort_order: 901 },
    ])
    .select('id');
  if (t.error) throw new Error(`tiers: ${t.error.message}`);
  for (const r of t.data!) tierIds.push(r.id as string);
  const g = await db().from('membership_product_group').insert([{ workspace_id: workspaceId, name: G1, sort_order: 900 }, { workspace_id: workspaceId, name: G2, sort_order: 901 }]).select('id, name');
  if (g.error) throw new Error(`groups: ${g.error.message}`);
  for (const r of g.data!) groupIds.push(r.id as string);
  const gid = (n: string) => g.data!.find((r) => r.name === n)!.id as string;
  const p = await db()
    .from('membership_product')
    .insert(
      [
        { name: `Fellowship ${STAMP}`, price_cents: 200000, price_interval: 'year', group_id: gid(G1), sort_order: 0 },
        { name: `Mentoring ${STAMP}`, price_cents: 50000, price_interval: 'year', group_id: gid(G1), sort_order: 1 },
        { name: `Retreat ${STAMP}`, price_cents: 90000, price_interval: 'once', group_id: gid(G1), sort_order: 2 },
        { name: `Email address ${STAMP}`, price_cents: 20000, price_interval: 'year', group_id: gid(G2), sort_order: 0 },
      ].map((r) => ({ workspace_id: workspaceId, purchasable: true, sold_without_membership: true, ...r })),
    )
    .select('id');
  if (p.error) throw new Error(`products: ${p.error.message}`);
  for (const r of p.data!) productIds.push(r.id as string);
});

test.afterAll(async () => {
  await db().from('membership_product').delete().in('id', productIds);
  await db().from('membership_product_group').delete().in('id', groupIds);
  await db().from('membership_tier').delete().in('id', tierIds);
  await db().from('workspace').update({ invoice_details: invoiceBefore }).eq('id', workspaceId);
  const [{ count: p }, { count: g }, { count: t }] = await Promise.all([
    db().from('membership_product').select('id', { count: 'exact', head: true }).in('id', productIds),
    db().from('membership_product_group').select('id', { count: 'exact', head: true }).in('id', groupIds),
    db().from('membership_tier').select('id', { count: 'exact', head: true }).in('id', tierIds),
  ]);
  expect({ p, g, t }).toEqual({ p: 0, g: 0, t: 0 });
  const { data: ws } = await db().from('workspace').select('invoice_details').eq('id', workspaceId).single();
  expect(ws!.invoice_details ?? null).toEqual(invoiceBefore);
});

test('price below on its own line; one left-aligned grid; a lone card sits in column 1', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${HOST}/${slug}`);
  const card = (name: string) => page.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name }) }).first();
  await expect(card(`Fellowship ${STAMP}`)).toBeVisible({ timeout: 30_000 });

  // The price block: the amount alone on its line, unit · VAT below it.
  const fellowship = card(`Fellowship ${STAMP}`);
  await expect(fellowship.getByText('per year · excl. VAT', { exact: true })).toBeVisible();
  const amount = fellowship.locator('.text-2xl').first();
  const unit = fellowship.getByText('per year · excl. VAT', { exact: true });
  const [a, u] = [await amount.boundingBox(), await unit.boundingBox()];
  expect(u!.y, 'the unit line sits BELOW the amount').toBeGreaterThanOrEqual(a!.y + a!.height - 1);
  await expect(card(`Retreat ${STAMP}`).getByText('one-off · excl. VAT', { exact: true })).toBeVisible();

  // One grid: every card the same width; the lone Tools card starts where
  // Pathways' first card does; headings left-aligned.
  const widths = await Promise.all([`Fellowship ${STAMP}`, `Mentoring ${STAMP}`, `Retreat ${STAMP}`, `Email address ${STAMP}`].map(async (n) => (await card(n).boundingBox())!));
  for (const b of widths) expect(Math.abs(b.width - widths[0]!.width), 'same width').toBeLessThanOrEqual(1);
  expect(Math.abs(widths[3]!.x - widths[0]!.x), 'lone card in column 1').toBeLessThanOrEqual(1);
  for (const h of [G1, G2]) {
    await expect(page.getByRole('heading', { name: h, exact: true })).toHaveCSS('text-align', /start|left/);
  }

  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/join-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/join-375.png`, fullPage: true });
  }
});
