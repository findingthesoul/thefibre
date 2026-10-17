// STOP RENEWAL, QUIETLY (Sjoerd, 2026-10-17: "make the stop renewal not so
// easily visible at every possible spot. It needs to be clear, but people do
// not need to be nudged to click on it whenever they can.").
// Purchases is the one place: the row states the fact and ends in a text
// link "Manage renewal" (no Stop button on the row); the window holds Stop,
// and Stop asks once more. Once stopped, the row says "Does not renew" with
// a "Resume renewal" link, and Memberships says the same rather than
// "Renews …". The shop states "Renews automatically" and links nowhere.
// Fixture setup below is member-addon.spec's (a REAL Stripe TEST
// subscription), plus a renewing add-on grant so the shop has a row.
// On STAGING, as the E2E FIXTURE (never a person): the fixture is made a member
// with a REAL Stripe TEST subscription, signs in, opens its community's public
// page, sees "Add to your membership" on a members-only renewing product,
// pays Stripe's prorated figure, and the grant is read back from the database
// — active, on that subscription.
//
// Stripe TEST through its REST API (the e2e package carries no SDK), with the
// key the integration suites use (apps/api/.env.staging), refused unless it
// is sk_test_. Exclusive project: it sets the fixture's member row. Everything
// is put back BY VALUE or removed by id, and read back.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

// MY_BASE points the my.thread pages at a local build (with the staging
// session copied to localhost); SHOTS names a directory for screenshots.
const BASE = process.env.MY_BASE ?? HOSTS.my;

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../apps/api/.env.staging'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const SK = env.STRIPE_SECRET_KEY ?? '';

async function stripe<T = Record<string, unknown>>(path: string, account: string, form?: Record<string, string>, method = 'POST'): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${SK}`, 'Stripe-Account': account, 'Content-Type': 'application/x-www-form-urlencoded' },
    ...(form ? { body: new URLSearchParams(form).toString() } : {}),
  });
  const body = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(`stripe ${path}: ${body.error?.message ?? res.status}`);
  return body;
}

const STAMP = Date.now().toString(36);
const NAME = `E2E members email ${STAMP}`;
// Named apart from the product, so a wait for the product never matches the tier.
const TIER = `E2E addon tier ${STAMP}`;
let workspaceId = '';
let slug = '';
let personId = '';
let account = '';
let tierId = '';
let productId = '';
let customerId = '';
let subId = '';
let memberBefore: Record<string, unknown> | null = null;
let accountBefore: string | null = null;

test.beforeAll(async () => {
  expect(SK.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const db = stagingService();
  const identity = await fixtureIdentity();
  workspaceId = identity.workspaceId;
  const { data: ws } = await db.from('workspace').select('slug, stripe_account_id').eq('id', workspaceId).single();
  slug = ws!.slug as string;
  accountBefore = (ws!.stripe_account_id as string | null) ?? null;
  const { data: donor } = await db.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  await db.from('workspace').update({ stripe_account_id: account }).eq('id', workspaceId);
  personId = ((await db.from('person').select('id').eq('workspace_id', workspaceId).ilike('email', identity.email).limit(1).single()).data!.id) as string;

  tierId = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: TIER, price_cents_year: 30000, hidden: true }).select('id').single()).data!.id as string;
  // Purchasable, renewing, MEMBERS ONLY (the default), no tier links = any tier.
  productId = (await db.from('membership_product').insert({ workspace_id: workspaceId, name: NAME, price_cents: 20000, price_interval: 'year', purchasable: true }).select('id').single()).data!.id as string;

  const customer = await stripe<{ id: string }>('customers', account, { email: identity.email });
  customerId = customer.id;
  const pm = await stripe<{ id: string }>(`payment_methods/pm_card_visa/attach`, account, { customer: customerId });
  await stripe(`customers/${customerId}`, account, { 'invoice_settings[default_payment_method]': pm.id });
  const product = await stripe<{ id: string }>('products', account, { name: `${slug} membership — ${TIER}` });
  const sub = await stripe<{ id: string }>('subscriptions', account, {
    customer: customerId,
    default_payment_method: pm.id,
    'items[0][price_data][currency]': 'eur',
    'items[0][price_data][product]': product.id,
    'items[0][price_data][unit_amount]': '30000',
    'items[0][price_data][recurring][interval]': 'year',
  });
  subId = sub.id;

  memberBefore = (await db.from('membership_member').select('*').eq('workspace_id', workspaceId).eq('person_id', personId).maybeSingle()).data ?? null;
  const m = await db
    .from('membership_member')
    .upsert({ workspace_id: workspaceId, person_id: personId, tier_id: tierId, status: 'active', stripe_subscription_id: subId, stripe_customer_id: customerId, renews_at: '2099-01-01T00:00:00Z', deleted_at: null }, { onConflict: 'workspace_id,person_id' })
    .select('id');
  if (m.error) throw new Error(`seed member: ${m.error.message}`);
  const g = await db.from('membership_product_purchase').insert({ workspace_id: workspaceId, person_id: personId, product_id: productId, stripe_session_id: `quiet-${STAMP}`, amount_cents: 20000, currency: 'EUR', status: 'active', stripe_subscription_id: subId, stripe_customer_id: customerId });
  if (g.error) throw new Error(`seed grant: ${g.error.message}`);
});

test.afterAll(async () => {
  const db = stagingService();
  if (subId) await stripe(`subscriptions/${subId}`, account, undefined, 'DELETE').catch(() => undefined);
  if (customerId) await stripe(`customers/${customerId}`, account, undefined, 'DELETE').catch(() => undefined);
  await db.from('membership_product_purchase').delete().eq('product_id', productId);
  await db.from('purchase').delete().eq('person_id', personId).like('item_label', `%${NAME}%`);
  if (memberBefore) await db.from('membership_member').upsert(memberBefore, { onConflict: 'workspace_id,person_id' });
  else await db.from('membership_member').delete().eq('workspace_id', workspaceId).eq('person_id', personId);
  await db.from('membership_product').delete().eq('id', productId);
  await db.from('membership_tier').delete().eq('id', tierId);
  await db.from('workspace').update({ stripe_account_id: accountBefore }).eq('id', workspaceId);
  const [{ count: grants }, { count: prods }, { count: tiers }] = await Promise.all([
    db.from('membership_product_purchase').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    db.from('membership_product').select('id', { count: 'exact', head: true }).eq('id', productId),
    db.from('membership_tier').select('id', { count: 'exact', head: true }).eq('id', tierId),
  ]);
  expect({ grants, prods, tiers }).toEqual({ grants: 0, prods: 0, tiers: 0 });
  const { data: ws } = await db.from('workspace').select('stripe_account_id').eq('id', workspaceId).single();
  expect(ws!.stripe_account_id ?? null).toBe(accountBefore);
});

const SHOTS = process.env.E2E_SHOTS ?? '';

test('stop renewal lives behind "Manage renewal" in Purchases, and nowhere else', async ({ page }) => {
  test.setTimeout(240_000);
  await landSignedIn(page, HOSTS.membership, 'membership', '/tiers', /\/tiers|no-access/);
  if (BASE !== HOSTS.my) {
    const cookies = (await page.context().cookies()).filter((c) => c.name.startsWith('sb-'));
    await page.context().addCookies(cookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })));
  }

  // The shop: the fact, no way to stopping.
  await page.goto(`${BASE}/shop`, { timeout: 180_000 });
  const owned = page.locator('li', { hasText: NAME });
  await expect(owned).toBeVisible({ timeout: 60_000 });
  await expect(owned.getByText('Renews automatically')).toBeVisible();
  await expect(page.getByRole('link', { name: /Stop renewal/ })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/shop-desktop.png`, fullPage: true });

  // Purchases: no Stop button on the row, a quiet "Manage renewal" link.
  await page.goto(`${BASE}/purchases`);
  const row = page.locator('li', { hasText: TIER });
  await expect(row.getByText(/Renews on/)).toBeVisible({ timeout: 60_000 });
  await waitForHydration(page, 'button');
  await expect(row.getByRole('button', { name: 'Stop renewal' })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Add or change' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/purchases-desktop.png`, fullPage: true });
  await row.getByRole('button', { name: 'Manage renewal' }).click();
  const manage = page.getByRole('dialog', { name: 'Manage renewal' });
  await expect(manage.getByText(/Renews on/)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/purchases-1-manage.png` });
  await manage.getByRole('button', { name: 'Stop renewal' }).click();
  const confirm = page.getByRole('dialog', { name: 'Stop the renewal?' });
  await expect(confirm).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/purchases-2-confirm.png` });
  await confirm.getByRole('button', { name: 'Stop renewal' }).click();

  // Stopped: the fact, and an easy way back.
  await expect(row.getByText(/Does not renew/)).toBeVisible({ timeout: 30_000 });
  await expect(row.getByRole('button', { name: 'Resume renewal' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/purchases-3-stopped.png`, fullPage: true });

  // Memberships no longer claims "Renews …" for a stopped renewal.
  await page.goto(`${BASE}/memberships`);
  await expect(page.getByText(/Does not renew/).first()).toBeVisible({ timeout: 60_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/memberships-stopped.png`, fullPage: true });

  // Resume puts it back.
  await page.goto(`${BASE}/purchases`);
  await waitForHydration(page, 'button');
  await row.getByRole('button', { name: 'Resume renewal' }).click();
  await page.getByRole('dialog', { name: 'Resume the renewal?' }).getByRole('button', { name: 'Resume renewal' }).click();
  await expect(row.getByRole('button', { name: 'Manage renewal' })).toBeVisible({ timeout: 30_000 });
  // And Stripe agrees: the subscription renews again.
  const sub = await stripe<{ cancel_at_period_end: boolean }>(`subscriptions/${subId}`, account, undefined, 'GET');
  expect(sub.cancel_at_period_end).toBe(false);
});
