// my.thread's sign-in says what went wrong in the reader's language, with the
// next step — never Supabase's own English (2026-10-17: a member on
// production saw "Token has expired or is invalid").
//
// The two Supabase calls are intercepted in the browser and answered the way
// Supabase answers them, so no email is sent and no rate limit is touched;
// what is under test is the screen's reading of the answer.

import { expect, test, type Page } from '@playwright/test';
import { HOSTS } from './helpers.js';

const BASE = process.env.MY_BASE_URL ?? `${HOSTS.my}/`;

async function fakeSupabase(page: Page, verify: { status: number; body: object }) {
  let otpCalls = 0;
  await page.route('**/auth/v1/otp**', (route) => {
    otpCalls += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/auth/v1/verify**', (route) =>
    route.fulfill({ status: verify.status, contentType: 'application/json', body: JSON.stringify(verify.body) }),
  );
  return () => otpCalls;
}

test.describe('in Dutch', () => {
  test.use({ locale: 'nl-NL' });

  test('an expired code says so, and "Stuur een nieuwe code" sends one', async ({ page }) => {
    const otpCalls = await fakeSupabase(page, {
      status: 403,
      body: { code: 'otp_expired', error_code: 'otp_expired', msg: 'Token has expired or is invalid' },
    });
    await page.goto(BASE);
    await page.getByLabel('Je e-mailadres').fill('someone@example.com');
    await page.getByRole('button', { name: 'Mail mij een code' }).click();
    await page.getByPlaceholder('8-cijferige code').fill('12345678');
    await page.getByRole('button', { name: 'Inloggen' }).click();

    await expect(page.getByText('Deze code werkt niet meer. Vraag een nieuwe aan.')).toBeVisible();
    await expect(page.getByText(/Token has expired/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Stuur een nieuwe code' }).click();
    await expect(page.getByText('Er is een nieuwe code onderweg.')).toBeVisible();
    expect(otpCalls()).toBe(2);
  });
});

test.describe('the rate limit', () => {
  test.use({ locale: 'de-DE' });

  test('names the wait, in German', async ({ page }) => {
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 52 seconds.' }),
      }),
    );
    await page.goto(BASE);
    await page.getByLabel('Deine E-Mail-Adresse').fill('someone@example.com');
    await page.getByRole('button', { name: 'Code per E-Mail senden' }).click();
    await expect(page.getByText('Bitte warte 52 Sekunden und fordere dann einen neuen Code an.')).toBeVisible();
    await expect(page.getByText(/For security purposes/)).toHaveCount(0);
  });
});
