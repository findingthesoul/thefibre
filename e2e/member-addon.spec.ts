// ADD TO YOUR MEMBERSHIP from the public page (2026-10-16, production
// soul.com: an existing member could not buy the members-only email address).
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

const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, '../apps/api/.env.staging'), 'utf8')
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

const NAME = `E2E members email ${Date.now().toString(36)}`;
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

  tierId = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: `${NAME} tier`, price_cents_year: 30000, hidden: true }).select('id').single()).data!.id as string;
  // Purchasable, renewing, MEMBERS ONLY (the default), no tier links = any tier.
  productId = (await db.from('membership_product').insert({ workspace_id: workspaceId, name: NAME, price_cents: 20000, price_interval: 'year', purchasable: true }).select('id').single()).data!.id as string;

  const customer = await stripe<{ id: string }>('customers', account, { email: identity.email });
  customerId = customer.id;
  const pm = await stripe<{ id: string }>(`payment_methods/pm_card_visa/attach`, account, { customer: customerId });
  await stripe(`customers/${customerId}`, account, { 'invoice_settings[default_payment_method]': pm.id });
  const product = await stripe<{ id: string }>('products', account, { name: `${slug} membership — ${NAME} tier` });
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

test('a signed-in member adds a members-only product to their membership from the public page', async ({ page }) => {
  test.setTimeout(150_000);
  // Signed in on the Members host — the session cookie spans the apex.
  await landSignedIn(page, HOSTS.membership, 'membership', '/tiers', /\/tiers|no-access/);
  await page.goto(`${HOSTS.membership}/${slug}`);
  await waitForHydration(page, 'button');
  const card = page.locator('div').filter({ has: page.getByRole('heading', { name: NAME }) }).last();
  const add = card.getByRole('button', { name: 'Add to your membership' });
  await expect(add).toBeVisible({ timeout: 30_000 });
  await add.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/now/)).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: /^Pay / }).click();
  await expect(dialog.getByText('is added to your membership')).toBeVisible({ timeout: 30_000 });
  // Asked of the DATABASE: active, on that subscription.
  await expect
    .poll(async () => (await stagingService().from('membership_product_purchase').select('status, stripe_subscription_id').eq('product_id', productId).maybeSingle()).data, { timeout: 20_000 })
    .toEqual({ status: 'active', stripe_subscription_id: subId });
});
