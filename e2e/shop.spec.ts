// my.thread → SHOP (2026-10-17, Sjoerd: "shop as recommended"), on STAGING as
// the E2E FIXTURE (never a person). The fixture is made a member with a REAL
// Stripe TEST subscription (as e2e/member-addon.spec.ts does), and its
// community gets five products — one of each kind the shop must place or
// leave out:
//   members-only (renewing, any tier) → "For members", Add to membership;
//   open (purchasable one-off)        → "For everyone", Buy → Stripe Checkout;
//   owned (a live grant)              → "You have this", never offered;
//   archived and unpurchasable        → nowhere.
// "Add to membership" opens the Add-or-change dialog with that product chosen
// and its preview shown — nothing is confirmed, nothing charged. "Buy" is
// followed only as far as Stripe's checkout host. Exclusive project: it sets
// the fixture's member row. Everything is put back by value or removed by id.
//
// E2E_MY_HOST points it at a LOCAL my.thread against the staging API, signed
// in with a planted FIXTURE session, so screenshots exist before a release.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

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
const TIER = `E2E shop tier ${STAMP}`;
const P = {
  membersOnly: `E2E shop members email ${STAMP}`,
  open: `E2E shop workbook ${STAMP}`,
  owned: `E2E shop retreat ${STAMP}`,
  archived: `E2E shop old songbook ${STAMP}`,
  unpurchasable: `E2E shop private lesson ${STAMP}`,
};
const HOST = process.env.E2E_MY_HOST ?? HOSTS.my;
const SHOTS = process.env.E2E_SHOTS ?? '';
let workspaceId = '';
let slug = '';
let wsName = '';
let personId = '';
let account = '';
let tierId = '';
const productIds: string[] = [];
let customerId = '';
let subId = '';
let memberBefore: Record<string, unknown> | null = null;
let accountBefore: string | null = null;

test.beforeAll(async () => {
  expect(SK.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const db = stagingService();
  const identity = await fixtureIdentity();
  workspaceId = identity.workspaceId;
  const { data: ws } = await db.from('workspace').select('slug, name, stripe_account_id').eq('id', workspaceId).single();
  slug = ws!.slug as string;
  wsName = ws!.name as string;
  accountBefore = (ws!.stripe_account_id as string | null) ?? null;
  const { data: donor } = await db.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  await db.from('workspace').update({ stripe_account_id: account }).eq('id', workspaceId);
  personId = ((await db.from('person').select('id').eq('workspace_id', workspaceId).ilike('email', identity.email).limit(1).single()).data!.id) as string;

  tierId = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: TIER, price_cents_year: 30000, hidden: true }).select('id').single()).data!.id as string;
  // Uniform keys: a multi-row insert NULLs a missing key.
  const rows = [
    { name: P.membersOnly, price_cents: 20000, price_interval: 'year', purchasable: true, sold_without_membership: false, archived_at: null },
    { name: P.open, price_cents: 1500, price_interval: 'once', purchasable: true, sold_without_membership: false, archived_at: null },
    { name: P.owned, price_cents: 9000, price_interval: 'once', purchasable: true, sold_without_membership: false, archived_at: null },
    { name: P.archived, price_cents: 1200, price_interval: 'once', purchasable: true, sold_without_membership: false, archived_at: new Date().toISOString() },
    { name: P.unpurchasable, price_cents: 4500, price_interval: 'once', purchasable: false, sold_without_membership: false, archived_at: null },
  ].map((r) => ({ workspace_id: workspaceId, ...r }));
  const ins = await db.from('membership_product').insert(rows).select('id, name');
  if (ins.error) throw new Error(`seed products: ${ins.error.message}`);
  for (const r of ins.data!) productIds.push(r.id as string);
  const ownedId = ins.data!.find((r) => r.name === P.owned)!.id as string;
  const g = await db.from('membership_product_purchase').insert({ workspace_id: workspaceId, person_id: personId, product_id: ownedId, stripe_session_id: `e2e-shop-${STAMP}`, amount_cents: 9000, status: 'paid' });
  if (g.error) throw new Error(`seed owned: ${g.error.message}`);

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
});

test.afterAll(async () => {
  const db = stagingService();
  if (subId) await stripe(`subscriptions/${subId}`, account, undefined, 'DELETE').catch(() => undefined);
  if (customerId) await stripe(`customers/${customerId}`, account, undefined, 'DELETE').catch(() => undefined);
  await db.from('membership_product_purchase').delete().in('product_id', productIds);
  if (memberBefore) await db.from('membership_member').upsert(memberBefore, { onConflict: 'workspace_id,person_id' });
  else await db.from('membership_member').delete().eq('workspace_id', workspaceId).eq('person_id', personId);
  await db.from('membership_product').delete().in('id', productIds);
  await db.from('membership_tier').delete().eq('id', tierId);
  await db.from('workspace').update({ stripe_account_id: accountBefore }).eq('id', workspaceId);
  const [{ count: grants }, { count: prods }, { count: tiers }] = await Promise.all([
    db.from('membership_product_purchase').select('id', { count: 'exact', head: true }).in('product_id', productIds),
    db.from('membership_product').select('id', { count: 'exact', head: true }).in('id', productIds),
    db.from('membership_tier').select('id', { count: 'exact', head: true }).eq('id', tierId),
  ]);
  expect({ grants, prods, tiers }).toEqual({ grants: 0, prods: 0, tiers: 0 });
  const { data: ws } = await db.from('workspace').select('stripe_account_id').eq('id', workspaceId).single();
  expect(ws!.stripe_account_id ?? null).toBe(accountBefore);
});

/** A LOCAL my.thread cannot redeem the hosted sign-in hop, so the FIXTURE's
 *  session is made server-side and planted as the Supabase auth cookie
 *  (as e2e/products-rows.spec.ts does). Fixture only, never a person. */
async function open(page: Page) {
  if (/localhost|127\.0\.0\.1/.test(HOST)) {
    const { email } = await fixtureIdentity();
    const link = await stagingService().auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) throw new Error(`e2e: generateLink: ${link.error.message}`);
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const v = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
    if (v.error || !v.data.session) throw new Error(`e2e: verifyOtp: ${v.error?.message ?? 'no session'}`);
    const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
    const value = 'base64-' + Buffer.from(JSON.stringify(v.data.session)).toString('base64url');
    const name = `sb-${ref}-auth-token`;
    const chunks = value.match(/.{1,3180}/g)!;
    const host = new URL(HOST).hostname;
    await page.context().addCookies((chunks.length === 1 ? [{ name, value }] : chunks.map((c, i) => ({ name: `${name}.${i}`, value: c }))).map((c) => ({ ...c, domain: host, path: '/' })));
    await page.goto(`${HOST}/shop`);
  } else {
    await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
    await page.goto(`${HOST}/shop`);
  }
  await waitForHydration(page, 'a, button');
}

test('the shop places each product, offers nothing owned, archived or unpurchasable', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  const section = page.locator(`section[data-community="${wsName}"]`);
  await expect(section).toBeVisible({ timeout: 30_000 });

  const row = (name: string) => section.locator(`li[data-item="${name}"]`);
  await expect(row(P.membersOnly).getByRole('button', { name: 'Add to membership' })).toBeVisible();
  await expect(row(P.open).getByRole('button', { name: 'Buy' })).toBeVisible();
  await expect(row(P.owned)).toBeVisible();
  await expect(row(P.owned).getByRole('button')).toHaveCount(0);
  for (const never of [P.archived, P.unpurchasable]) await expect(section.getByText(never)).toHaveCount(0);
  // Each product in one place only.
  for (const name of Object.values(P)) expect(await section.locator(`li[data-item="${name}"]`).count()).toBeLessThanOrEqual(1);

  if (SHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/shop-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/shop-375.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
  }

  // Add → the Add-or-change dialog, THIS product chosen and previewed.
  await row(P.membersOnly).getByRole('button', { name: 'Add to membership' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio', { name: new RegExp(P.membersOnly) })).toBeChecked({ timeout: 30_000 });
  // "Pay €…" when something is due now (Stripe's prorated figure), else "Confirm".
  await expect(dialog.getByRole('button', { name: /^(Pay |Confirm)/ })).toBeEnabled({ timeout: 30_000 });
  await page.keyboard.press('Escape');

  // Buy → Stripe Checkout (followed only as far as its host).
  await row(P.open).getByRole('button', { name: 'Buy' }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
});
