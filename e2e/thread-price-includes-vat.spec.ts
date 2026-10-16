// "Price includes VAT" on a THREAD ticket (2026-10-16), seen on the public
// page on staging.
//
// The charge is the integration test's (thread-meet-vat.int.test.ts reads the
// Stripe Checkout session: 363 = 300 + 63). This is what a visitor reads: the
// entered €363, the note "€363 incl. 21% VAT" — which is only right if the
// page handed the shared note the NET (300) and not the entered price; a
// double count would say €439 — and the line that tells them this price
// already includes VAT.
//
// A throwaway public thread in the permanent enrol-fixtures workspace, its
// organiser VAT-registered in person (their own invoice details, as a real
// organiser selling under their own name). Removed afterwards.

import { expect, test } from '@playwright/test';
import { HOSTS, createPublicThread, stagingService, waitForHydration, type E2eThreadFixture } from './helpers.js';

let fx: E2eThreadFixture;
let userId = '';
let ticketId = '';

test.beforeAll(async () => {
  const db = stagingService();
  fx = await createPublicThread('inclvat');
  const { data: t } = await db.from('thread_thread').select('organiser:organiser_id (user_id)').eq('id', fx.threadId).single();
  const org = (Array.isArray(t!.organiser) ? t!.organiser[0] : t!.organiser) as { user_id: string };
  userId = org.user_id;
  const prof = await db
    .from('user_profile')
    .upsert({ user_id: userId, invoice_details: { legal_name: 'E2E Organiser', vat_registered: true, vat_rate_pct: 21 } }, { onConflict: 'user_id' });
  if (prof.error) throw new Error(`profile: ${prof.error.message}`);
  await db.from('thread_thread').update({ payment_methods: ['invoice'], payment_destination: 'personal' }).eq('id', fx.threadId);
  const tk = await db
    .from('thread_ticket')
    .insert({ workspace_id: fx.workspaceId, thread_id: fx.threadId, name: 'Standard', price_cents: 36300, price_currency: 'EUR', is_active: true, payment_methods: ['invoice'], price_includes_vat: true, position: 0 })
    .select('id')
    .single();
  if (tk.error) throw new Error(`ticket: ${tk.error.message}`);
  ticketId = tk.data.id as string;
});

test.afterAll(async () => {
  const db = stagingService();
  if (ticketId) await db.from('thread_ticket').delete().eq('id', ticketId);
  if (userId) await db.from('user_profile').delete().eq('user_id', userId);
  if (fx) await fx.cleanup();
  const { data } = await db.from('thread_ticket').select('id').eq('id', ticketId);
  expect(data ?? []).toEqual([]);
});

test('the public page shows €363 incl. 21% VAT, never VAT on top of it', async ({ page }) => {
  await page.goto(`${HOSTS.thread}/${fx.organiserSlug}/${fx.threadSlug}`);
  await waitForHydration(page);
  const body = page.locator('body');
  await expect(body).toContainText(/363/);
  await expect(body).toContainText(/363([.,]00)?\s*incl\.\s*21%\s*VAT/i);
  // Before a country is chosen: the price already includes VAT.
  await expect(body).toContainText('This price includes VAT');
  await expect(body).not.toContainText('Prices are excl. VAT');
  // A double count would read 363 + 21% = 439.
  await expect(body).not.toContainText(/439/);
});
