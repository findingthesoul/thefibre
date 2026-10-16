// my.thread → Memberships: the Google address card (builder 4's routes), on
// STAGING as the FIXTURE, read-only.
//
// No staging workspace has Google connected, so the real API answers
// `applies: false` for everybody — the first test asserts exactly that (no
// card). The card's own states are then driven by intercepting ONLY the two
// /me/google calls in the browser: the page, the card, the copy and the error
// handling are the real staging build; the answers are stand-ins with the
// API's documented shape (lib/google-account.ts memberView) and its error
// codes. Nothing is written anywhere.

import { expect, test, type Page } from '@playwright/test';
import { HOSTS, landSignedIn, waitForHydration } from './helpers.js';

const base = (over: Record<string, unknown>) => ({
  applies: true,
  domain: 'example.org',
  status: 'suggested',
  suggested_address: 'e2e.member@example.org',
  requested_address: null,
  created_address: null,
  note: null,
  decline_reason: null,
  ...over,
});

async function open(page: Page) {
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  await page.goto(`${HOSTS.my}/memberships`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await waitForHydration(page, 'a, button');
}

test('with no Google connected, no card is shown', async ({ page }) => {
  test.setTimeout(120_000);
  let asked = 0;
  page.on('request', (r) => {
    if (r.url().includes('/membership/portal/me/google')) asked++;
  });
  await open(page);
  await expect.poll(() => asked, { timeout: 20_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await expect(page.getByRole('region', { name: 'Google account' })).toHaveCount(0);
});

test('suggested → ask for another → taken is said in words → requested', async ({ page }) => {
  test.setTimeout(120_000);
  let posts = 0;
  await page.route('**/api/v1/membership/portal/me/google**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: base({}) });
    posts++;
    const body = req.postDataJSON() as { action: string; local_part?: string };
    if (body.local_part === 'taken') return route.fulfill({ status: 409, json: { error: 'that address is already taken', code: 'address_taken' } });
    return route.fulfill({ json: base({ status: 'requested', requested_address: `${body.local_part}@example.org` }) });
  });
  await open(page);
  const card = page.getByRole('region', { name: 'Google account' }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText('e2e.member@example.org')).toBeVisible();

  await card.getByRole('button', { name: 'Ask for another' }).click();
  await expect(card.getByLabel('Address')).toHaveValue('e2e.member');
  await card.getByLabel('Address').fill('taken');
  await card.getByRole('button', { name: 'Ask for it' }).click();
  await expect(card.getByText('That address is already taken. Try another.')).toBeVisible();

  await card.getByLabel('Address').fill('e2e.other');
  await card.getByRole('button', { name: 'Ask for it' }).click();
  await expect(card.getByText('You asked for e2e.other@example.org.', { exact: false })).toBeVisible();
  expect(posts).toBe(2);
});

test('created and declined read as they should', async ({ page }) => {
  test.setTimeout(120_000);
  let state: Record<string, unknown> = base({ status: 'created', created_address: 'done@example.org' });
  await page.route('**/api/v1/membership/portal/me/google**', (route) => route.fulfill({ json: state }));
  await open(page);
  const card = page.getByRole('region', { name: 'Google account' }).first();
  await expect(card.getByText('Your Google account: done@example.org')).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole('button')).toHaveCount(0);

  state = base({ status: 'declined', decline_reason: 'Not this one' });
  await page.reload();
  await expect(card.getByText('The community declined your request.')).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText('Reason: Not this one')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Ask again' })).toBeVisible();
});
