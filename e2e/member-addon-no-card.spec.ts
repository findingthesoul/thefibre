// ADDING WITHOUT A CARD (v1.277.13, 2026-10-17): a member who paid the year
// by invoice has no card. On STAGING, as the E2E FIXTURE (never a person): a
// Stripe TEST subscription TRIALING to 2027-01-01 with no payment method, and
// a renewing members-only product whose first period ends 2026-12-31, so
// adding it costs something NOW. The Add or change window must say a card is
// needed, show the card line with its "change", and keep Pay disabled. At a
// phone width, in English and Dutch. Nothing is bought; everything is put back
// BY VALUE or removed by id. Also: the membership row on Purchases asks for a
// card before the renewal date, and the price line drops "with the card on
// your membership".

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
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
const NAME = `E2E nocard email ${STAMP}`;
const TIER = `E2E nocard tier ${STAMP}`;
let workspaceId = '';
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
  const { data: ws } = await db.from('workspace').select('stripe_account_id').eq('id', workspaceId).single();
  accountBefore = (ws!.stripe_account_id as string | null) ?? null;
  const { data: donor } = await db.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  await db.from('workspace').update({ stripe_account_id: account }).eq('id', workspaceId);
  personId = ((await db.from('person').select('id').eq('workspace_id', workspaceId).ilike('email', identity.email).limit(1).single()).data!.id) as string;
  tierId = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: TIER, price_cents_year: 30000, hidden: true }).select('id').single()).data!.id as string;
  productId = (await db.from('membership_product').insert({ workspace_id: workspaceId, name: NAME, price_cents: 20000, price_interval: 'year', purchasable: true, first_period_ends_on: '2026-12-31' }).select('id').single()).data!.id as string;
  // No payment method anywhere: the customer has none, the subscription none.
  customerId = (await stripe<{ id: string }>('customers', account, { email: identity.email })).id;
  const product = await stripe<{ id: string }>('products', account, { name: `nocard membership ${TIER}` });
  subId = (
    await stripe<{ id: string }>('subscriptions', account, {
      customer: customerId,
      trial_end: String(Math.floor(Date.UTC(2027, 0, 1) / 1000)),
      'items[0][price_data][currency]': 'eur',
      'items[0][price_data][product]': product.id,
      'items[0][price_data][unit_amount]': '30000',
      'items[0][price_data][recurring][interval]': 'year',
    })
  ).id;
  memberBefore = (await db.from('membership_member').select('*').eq('workspace_id', workspaceId).eq('person_id', personId).maybeSingle()).data ?? null;
  const m = await db
    .from('membership_member')
    .upsert({ workspace_id: workspaceId, person_id: personId, tier_id: tierId, status: 'active', stripe_subscription_id: subId, stripe_customer_id: customerId, renews_at: '2027-01-01T00:00:00Z', deleted_at: null }, { onConflict: 'workspace_id,person_id' })
    .select('id');
  if (m.error) throw new Error(`seed member: ${m.error.message}`);
});

test.afterAll(async () => {
  const db = stagingService();
  if (subId) await stripe(`subscriptions/${subId}`, account, undefined, 'DELETE').catch(() => undefined);
  if (customerId) await stripe(`customers/${customerId}`, account, undefined, 'DELETE').catch(() => undefined);
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
const WORDS = {
  en: { open: 'Add or change', needs: /Add a card to your membership first/, change: 'change', banner: /Add a card before 1 January 2027/, withCard: /with the card on your membership/, recheck: 'Card added? Check again', pay: /^(Pay |Confirm)/ },
  nl: { open: 'Toevoegen of wijzigen', needs: /Voeg eerst een kaart toe/, change: 'wijzigen', banner: /Voeg vóór 1 januari 2027 een kaart toe/, withCard: /met de kaart van je lidmaatschap/, recheck: 'Kaart toegevoegd? Opnieuw controleren', pay: /^(Betaal|Bevestig)/ },
} as const;

for (const lang of ['en', 'nl'] as const) {
  test(`no card: the window asks for one and Pay stays off (${lang}, 375)`, async ({ page, context }) => {
    test.setTimeout(150_000);
    await landSignedIn(page, HOSTS.membership, 'membership', '/tiers', /\/tiers|no-access/);
    await context.addCookies([{ name: 'thefibre.locale', value: lang, domain: '.thefibre.tech', path: '/' }]);
    await page.setViewportSize({ width: 375, height: 812 });
    const w = WORDS[lang];
    await page.goto(`${HOSTS.my}/purchases`);
    const open = page.getByRole('button', { name: w.open }).first();
    await expect(open).toBeVisible({ timeout: 30_000 });
    // The membership's row asks for a card before the renewal — the same ask
    // as the reminder email (no card, charged automatically, trialing to 1 Jan).
    await expect(page.getByText(w.banner)).toBeVisible({ timeout: 30_000 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nocard-banner-${lang}-375.png` });
    await open.click();
    const dialog = page.getByRole('dialog');
    const pick = dialog.getByRole('radio', { name: new RegExp(NAME) });
    await expect(pick).toBeVisible({ timeout: 30_000 });
    await pick.check();
    await expect(dialog.getByText(w.needs)).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole('button', { name: w.change, exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: w.recheck })).toBeVisible();
    await expect(dialog.getByRole('button', { name: w.pay })).toBeDisabled();
    // The price line no longer says it uses a card the member does not have.
    await expect(dialog.getByText(w.withCard)).toHaveCount(0);
    if (SHOTS) {
      await dialog.getByText(w.needs).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/nocard-${lang}-375.png` });
    }
    // Nothing was bought.
    const { count } = await stagingService().from('membership_product_purchase').select('id', { count: 'exact', head: true }).eq('product_id', productId);
    expect(count).toBe(0);
  });
}
