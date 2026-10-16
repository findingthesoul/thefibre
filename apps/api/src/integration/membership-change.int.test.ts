// my.thread → Purchases, P3: a member adds an add-on of their tier, or moves
// to another tier — in The Fibre, on the ONE subscription they have, so there
// is one renewal date. Against staging and a Stripe TEST subscription on the
// fixtures' connected account.
//
// The PERMANENT fixture workspace of the renewal test: these writes log
// activity, activity is append-only, and a throwaway workspace holding one
// can never be deleted (testing-approach §17).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let user: FixtureUser;
let account = '';
let subId = '';
let customerId = '';
let memberId = '';
let personId = '';
const tierIds: string[] = [];
const productIds: string[] = [];
let singer = '';
let soloist = '';
let sheetMusic = '';
let workshop = '';
let membersEmail = '';
let soloistPathway = '';
let openCircle = '';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

const call = (path: string, body?: unknown) =>
  app.request(`/api/v1/membership/portal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const periodEnd = async () =>
  (await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account })).items.data.map((it) => it.current_period_end);

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { membershipPurchaseRoutes } = await import('../routes/membership-purchases.js');
  app = new Hono();
  const v1 = new Hono();
  v1.route('/membership/portal', membershipPurchaseRoutes);
  app.route('/api/v1', v1);

  const { data: donor } = await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  ws = await getPermanentFixtureWorkspace('int-renewal-fixtures');
  await service.from('workspace').update({ stripe_account_id: account, name: 'Renewal Community' }).eq('id', ws);
  user = await createFixtureUser(ws, 'change');

  const tiers = await service
    .from('membership_tier')
    .insert([
      { workspace_id: ws, name: 'Singer', price_cents_year: 30000, hidden: false },
      { workspace_id: ws, name: 'Soloist', price_cents_year: 60000, hidden: false },
      { workspace_id: ws, name: 'Hidden', price_cents_year: 1000, hidden: true },
    ])
    .select('id, name');
  expect(tiers.error).toBeNull();
  for (const t of tiers.data!) tierIds.push(t.id as string);
  singer = tiers.data!.find((t) => t.name === 'Singer')!.id as string;
  soloist = tiers.data!.find((t) => t.name === 'Soloist')!.id as string;
  const products = await service
    .from('membership_product')
    .insert([
      { workspace_id: ws, name: 'Sheet music', price_cents: 5000, price_interval: 'year' },
      { workspace_id: ws, name: 'Workshop', price_cents: 2000, price_interval: 'once' },
      { workspace_id: ws, name: 'Weekly coaching', price_cents: 900, price_interval: 'week' },
    ])
    .select('id, name');
  expect(products.error).toBeNull();
  for (const p of products.data!) productIds.push(p.id as string);
  sheetMusic = products.data!.find((p) => p.name === 'Sheet music')!.id as string;
  workshop = products.data!.find((p) => p.name === 'Workshop')!.id as string;
  await service.from('membership_tier_product').insert(productIds.map((product_id) => ({ tier_id: singer, product_id, optional: true })));
  // The MEMBER PATH (2026-10-16, soul.com): members-only renewing products,
  // purchasable but not opened to non-members. One with no tier links (any
  // tier), one offered only with Soloist, and one opened to anyone (not an
  // add-on). Uniform keys — a multi-row insert NULLs a missing key.
  const mo = await service
    .from('membership_product')
    .insert([
      { workspace_id: ws, name: 'Members email', price_cents: 20000, price_interval: 'year', purchasable: true, sold_without_membership: false },
      { workspace_id: ws, name: 'Soloist pathway', price_cents: 40000, price_interval: 'year', purchasable: true, sold_without_membership: false },
      { workspace_id: ws, name: 'Open circle', price_cents: 3000, price_interval: 'year', purchasable: true, sold_without_membership: true },
    ])
    .select('id, name');
  expect(mo.error).toBeNull();
  for (const p of mo.data!) productIds.push(p.id as string);
  membersEmail = mo.data!.find((p) => p.name === 'Members email')!.id as string;
  soloistPathway = mo.data!.find((p) => p.name === 'Soloist pathway')!.id as string;
  openCircle = mo.data!.find((p) => p.name === 'Open circle')!.id as string;
  await service.from('membership_tier_product').insert({ tier_id: soloist, product_id: soloistPathway, optional: true });

  const { data: person } = await service.from('person').insert({ workspace_id: ws, email: user.email, first_name: 'Carla' }).select('id').single();
  personId = person!.id as string;
  const customer = await stripe.customers.create({ email: user.email }, { stripeAccount: account });
  customerId = customer.id;
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id }, { stripeAccount: account });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } }, { stripeAccount: account });
  // Named the way the join names it, so the change finds the membership line.
  const product = await stripe.products.create({ name: 'Renewal Community membership — Singer' }, { stripeAccount: account });
  const sub = await stripe.subscriptions.create(
    { customer: customer.id, default_payment_method: pm.id, items: [{ price_data: { currency: 'eur', product: product.id, unit_amount: 30000, recurring: { interval: 'year' } } }] },
    { stripeAccount: account },
  );
  subId = sub.id;
  const { data: m } = await service
    .from('membership_member')
    .insert({ workspace_id: ws, person_id: personId, tier_id: singer, status: 'active', stripe_subscription_id: sub.id, stripe_customer_id: customer.id })
    .select('id')
    .single();
  memberId = m!.id as string;
}, 180_000);

afterAll(async () => {
  if (!personId) return; // setup never got as far as writing anything person-shaped
  await stripe.subscriptions.cancel(subId, {}, { stripeAccount: account }).catch(() => undefined);
  await stripe.customers.del(customerId, { stripeAccount: account }).catch(() => undefined);
  await service.from('membership_product_purchase').delete().eq('person_id', personId);
  await service.from('purchase').delete().eq('person_id', personId);
  await service.from('membership_member').delete().eq('id', memberId);
  await service.from('membership_tier_product').delete().in('tier_id', tierIds);
  await service.from('membership_product').delete().in('id', productIds);
  await service.from('membership_tier').delete().in('id', tierIds);
  // The Stripe product mappings this run made (one platform_setting row each).
  for (const id of [...productIds, ...tierIds]) {
    await service.from('platform_setting').delete().like('key', `membership_stripe_product:%:${id}`);
  }
  await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);
  if (user) await deleteFixtureUser(user);

  // §17: by id — other sessions' fixtures share the permanent workspace.
  const mappings = await Promise.all(
    [...productIds, ...tierIds].map(async (id) => (await service.from('platform_setting').select('key', { count: 'exact', head: true }).like('key', `membership_stripe_product:%:${id}`)).count ?? 0),
  );
  expect(mappings.reduce((a, b) => a + b, 0)).toBe(0);
  const [{ count: members }, { count: tiers }, { count: products }, { count: bought }, { count: ledger }, { count: livePersons }] = await Promise.all([
    service.from('membership_member').select('id', { count: 'exact', head: true }).eq('id', memberId),
    service.from('membership_tier').select('id', { count: 'exact', head: true }).in('id', tierIds),
    service.from('membership_product').select('id', { count: 'exact', head: true }).in('id', productIds),
    service.from('membership_product_purchase').select('id', { count: 'exact', head: true }).eq('person_id', personId),
    service.from('purchase').select('id', { count: 'exact', head: true }).eq('person_id', personId),
    service.from('person').select('id', { count: 'exact', head: true }).eq('id', personId).is('deleted_at', null),
  ]);
  expect({ members, tiers, products, bought, ledger, livePersons }).toEqual({ members: 0, tiers: 0, products: 0, bought: 0, ledger: 0, livePersons: 0 });
}, 180_000);

// The my.thread SHOP (GET /me/shop, lib/shop.ts): runs FIRST, before any
// add-on is added below. One community (the fixture), seen by a Singer with a
// yearly Stripe subscription. Seeds three more products — archived,
// unpurchasable, and one this member OWNS — removed with the rest by id.
describe('the shop: what this person may get, from where', () => {
  it('members-only = the add-on offer; open = sold alone; owned never offered; archived and unpurchasable never listed', async () => {
    const extra = await service
      .from('membership_product')
      .insert([
        { workspace_id: ws, name: 'Old songbook', price_cents: 1500, price_interval: 'once', purchasable: true, sold_without_membership: false, archived_at: new Date().toISOString() },
        { workspace_id: ws, name: 'Private lesson', price_cents: 4500, price_interval: 'once', purchasable: false, sold_without_membership: false, archived_at: null },
        { workspace_id: ws, name: 'Concert ticket', price_cents: 2500, price_interval: 'once', purchasable: true, sold_without_membership: false, archived_at: null },
      ])
      .select('id, name');
    expect(extra.error).toBeNull();
    for (const p of extra.data!) productIds.push(p.id as string);
    const ticket = extra.data!.find((p) => p.name === 'Concert ticket')!.id as string;
    const session = `int-shop-${Date.now()}`;
    const owned = await service
      .from('membership_product_purchase')
      .insert({ workspace_id: ws, person_id: personId, product_id: ticket, stripe_session_id: session, amount_cents: 2500, status: 'paid' });
    expect(owned.error).toBeNull();
    try {

    const r = await call('/me/shop');
    expect(r.status, await r.clone().text()).toBe(200);
    const { communities } = (await r.json()) as { communities: { workspace_id: string; member_id: string | null; members_only: { name: string; action: string; recurring: boolean }[]; open: { name: string; action: string }[]; owned: { name: string }[] }[] };
    const here = communities.find((x) => x.workspace_id === ws)!;
    expect(here, 'the community this person belongs to is listed').toBeTruthy();
    expect(here.member_id).toBe(memberId);

    const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort();
    // The same list "Add or change" offers (GET /me/options): the tier's
    // optional yearly and one-off add-ons, the any-tier members-only email —
    // NOT the weekly one (wrong interval), NOT Soloist pathway (other tier).
    const options = (await (await call(`/me/options/${memberId}`)).json()) as { addons: { name: string }[] };
    expect(names(here.members_only)).toEqual(names(options.addons));
    expect(names(here.members_only)).toEqual(['Members email', 'Sheet music', 'Workshop']);
    expect(here.members_only.every((x) => x.action === 'add_to_membership')).toBe(true);
    // Open: sold without a membership. Open circle (renewing, opened) is
    // subscribed to; the purchasable one-offs not already in members-only
    // are bought.
    expect(here.open.map((x) => [x.name, x.action]).sort()).toEqual([['Open circle', 'subscribe']]);
    // Owned: shown, and in neither list.
    expect(names(here.owned)).toEqual(['Concert ticket']);
    const everywhere = [...here.members_only, ...here.open].map((x) => x.name);
    for (const never of ['Concert ticket', 'Old songbook', 'Private lesson', 'Weekly coaching', 'Soloist pathway']) {
      expect(everywhere, `${never} is not offered`).not.toContain(never);
    }
    } finally {
      // The tests below count this person's grants; leave them as found.
      await service.from('membership_product_purchase').delete().eq('stripe_session_id', session);
    }
  });
});

describe('adding to a membership, and changing it', () => {
  it('lists what may be added and moved to — not a hidden tier, not a weekly add-on on a yearly membership', async () => {
    const r = await call(`/me/options/${memberId}`);
    expect(r.status, await r.clone().text()).toBe(200);
    const o = await r.json();
    expect(o).toMatchObject({ interval: 'year', currency: 'EUR', current_price_cents: 30000, downgrade: 'credit' });
    // + the members-only renewing product with no tier links (offered with ANY
    // tier, 2026-10-16); not the Soloist-only one, not the opened one.
    expect(o.addons.map((a: { name: string }) => a.name).sort()).toEqual(['Members email', 'Sheet music', 'Workshop']);
    expect(o.addons.find((a: { name: string }) => a.name === 'Sheet music').recurring).toBe(true);
    expect(o.tiers.map((t: { name: string }) => t.name)).toEqual(['Soloist']);
  });

  it('a recurring add-on: previewed prorated, then joins the ONE subscription with the same renewal date', async () => {
    const before = await periodEnd();
    const p = await call(`/me/addons/${memberId}/preview`, { product_id: sheetMusic });
    expect(p.status, await p.clone().text()).toBe(200);
    const q = await p.json();
    expect(q.due_now_cents).toBeGreaterThan(0);
    expect(q.due_now_cents).toBeLessThanOrEqual(5000);
    expect(q.then_cents).toBe(35000);

    // TWO AT ONCE (a double click, two tabs): one is added, one is refused.
    const invoicesBefore = (await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length;
    const [r1, r2] = await Promise.all([
      call(`/me/addons/${memberId}`, { product_id: sheetMusic, request_id: 'req_tab_one_0001' }),
      call(`/me/addons/${memberId}`, { product_id: sheetMusic, request_id: 'req_tab_two_0002' }),
    ]);
    expect([r1.status, r2.status].sort(), `${await r1.clone().text()} | ${await r2.clone().text()}`).toEqual([200, 409]);
    const sub = await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account });
    expect(sub.items.data).toHaveLength(2);
    // One prorated charge, not two.
    expect((await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length).toBe(invoicesBefore + 1);
    // And a retry later is refused the same way.
    const again = await call(`/me/addons/${memberId}`, { product_id: sheetMusic });
    expect(again.status).toBe(409);
    expect(new Set(await periodEnd())).toEqual(new Set(before));
    // A RECURRING add-on rides the membership's subscription and ends with it
    // (2026-10-16): 'active' on that subscription, not 'paid' for good.
    const { data: bought } = await service.from('membership_product_purchase').select('product_id, status, stripe_session_id, stripe_subscription_id').eq('person_id', personId);
    expect(bought).toEqual([expect.objectContaining({ product_id: sheetMusic, status: 'active', stripe_subscription_id: subId })]);
    // Held now, so no longer offered.
    const o = await (await call(`/me/options/${memberId}`)).json();
    expect(o.addons.map((a: { name: string }) => a.name).filter((n: string) => n !== 'Members email')).toEqual(['Workshop']);
  });

  it('a one-off add-on: its own invoice, paid, on the ledger once', async () => {
    const r = await call(`/me/addons/${memberId}`, { product_id: workshop });
    expect(r.status, await r.clone().text()).toBe(200);
    const out = await r.json();
    expect(out.amount_cents).toBe(2000);
    const inv = await stripe.invoices.retrieve(out.invoice_id, {}, { stripeAccount: account });
    expect(inv.status).toBe('paid');
    const { data: rows } = await service.from('purchase').select('item_ref, item_label, amount_cents, status').eq('item_ref', out.invoice_id);
    expect(rows).toEqual([{ item_ref: out.invoice_id, item_label: 'Renewal Community — Workshop', amount_cents: 2000, status: 'paid' }]);
  });

  it('an upgrade: previewed as pay-now, then the membership line moves, the renewal date stays', async () => {
    const before = await periodEnd();
    const p = await call(`/me/change/${memberId}/preview`, { tier_id: soloist });
    expect(p.status, await p.clone().text()).toBe(200);
    const q = await p.json();
    expect(q.due_now_cents).toBeGreaterThan(0);
    expect(q.credit_cents).toBe(0);
    expect(q.then_cents).toBe(65000);

    const invoicesBefore = (await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length;
    const [r1, r2] = await Promise.all([
      call(`/me/change/${memberId}`, { tier_id: soloist, request_id: 'req_tier_one_001' }),
      call(`/me/change/${memberId}`, { tier_id: soloist, request_id: 'req_tier_two_002' }),
    ]);
    expect([r1.status, r2.status].sort(), `${await r1.clone().text()} | ${await r2.clone().text()}`).toEqual([200, 409]);
    expect((await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length).toBe(invoicesBefore + 1);
    expect((await call(`/me/change/${memberId}`, { tier_id: soloist })).status).toBe(409); // already there
    const { data: m } = await service.from('membership_member').select('tier_id').eq('id', memberId).single();
    expect(m!.tier_id).toBe(soloist);
    const sub = await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account });
    expect(sub.items.data.map((it) => it.price.unit_amount).sort((a, b) => a! - b!)).toEqual([5000, 60000]);
    expect(new Set(await periodEnd())).toEqual(new Set(before));
  });

  it('a downgrade: credited on the next invoice, nothing refunded (the default switch)', async () => {
    const p = await call(`/me/change/${memberId}/preview`, { tier_id: singer });
    const q = await p.json();
    expect(p.status, JSON.stringify(q)).toBe(200);
    expect(q).toMatchObject({ due_now_cents: 0, downgrade: 'credit' });
    expect(q.credit_cents).toBeGreaterThan(0);
    const r = await call(`/me/change/${memberId}`, { tier_id: singer });
    const out = await r.json();
    expect(r.status, JSON.stringify(out)).toBe(200);
    expect(out.refunded_cents).toBe(0);
    expect(out.credit_cents).toBeGreaterThan(0);
    const customer = (await stripe.customers.retrieve(customerId, {}, { stripeAccount: account })) as Stripe.Customer;
    expect(customer.balance).toBeLessThan(0);
  });

  it('nobody else can change it', async () => {
    const other = await createFixtureUser(ws, 'change-other');
    try {
      const r = await app.request(`/api/v1/membership/portal/me/change/${memberId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${other.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_id: soloist }),
      });
      expect(r.status).toBe(404);
    } finally {
      await deleteFixtureUser(other);
    }
  });
});

// THE MEMBER PATH (2026-10-16, production soul.com: an existing member could
// not buy the members-only email address). The offer widens by ONE rule —
// addonCandidates — read by the offer list, the preview and the charge.
describe('a members-only renewing product, added to an existing membership', () => {
  it('the public page finds the membership: /me/member-in/<slug>', async () => {
    const r = await call('/me/member-in/int-renewal-fixtures');
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ member_id: memberId, can_add: true });
  });

  it('offered: members-only with no tier links (any tier); not: one opened to anyone, nor one for another tier', async () => {
    const { data: m } = await service.from('membership_member').select('tier_id').eq('id', memberId).single();
    const r = await call(`/me/options/${memberId}`);
    expect(r.status, await r.clone().text()).toBe(200);
    const ids = ((await r.json()).addons as { id: string }[]).map((a) => a.id);
    expect(ids).toContain(membersEmail);
    expect(ids).not.toContain(openCircle);
    // Offered only with Soloist: present exactly when the member is on it.
    expect(ids.includes(soloistPathway)).toBe(m!.tier_id === soloist);
  });

  it('preview, then add: a prorated charge now on THEIR subscription; the grant is active on it', async () => {
    const p = await call(`/me/addons/${memberId}/preview`, { product_id: membersEmail });
    expect(p.status, await p.clone().text()).toBe(200);
    expect((await p.json()).due_now_cents).toBeGreaterThan(0);
    const r = await call(`/me/addons/${memberId}`, { product_id: membersEmail });
    expect(r.status, await r.clone().text()).toBe(200);
    const { data: g } = await service.from('membership_product_purchase').select('status, stripe_subscription_id').eq('person_id', personId).eq('product_id', membersEmail).single();
    expect(g).toEqual({ status: 'active', stripe_subscription_id: subId });
    // Held now: no longer offered, and a second add is refused.
    const ids = ((await (await call(`/me/options/${memberId}`)).json()).addons as { id: string }[]).map((a) => a.id);
    expect(ids).not.toContain(membersEmail);
  });

  it('a product opened to anyone is not an add-on here (the page subscribes to it instead)', async () => {
    const r = await call(`/me/addons/${memberId}`, { product_id: openCircle });
    expect(r.status).toBe(404);
  });
});

