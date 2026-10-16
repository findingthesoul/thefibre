// The install bar on my.thread (InstallPrompt from @thefibre/shared;
// Sjoerd, 2026-10-16). Signed out — the sign-in screen carries the bar too,
// which is where someone installs from — so no fixture and no writes.
// beforeinstallprompt cannot be produced by a headless browser on demand, so
// the Android case dispatches one with a stubbed prompt(): it proves the bar
// waits for the browser and hands the click to it, not that Chrome's dialog
// looks right.

import { devices, expect, test } from '@playwright/test';
import { HOSTS } from './helpers.js';

const BASE = `${HOSTS.my}/`;
const IPHONE = devices['iPhone 13'];

test.describe('iPhone Safari', () => {
  test.use({ userAgent: IPHONE.userAgent, viewport: IPHONE.viewport, locale: 'nl-NL' });

  test('shows the steps, in the reader’s language, and Not now persists', async ({ page }) => {
    await page.goto(BASE);
    const bar = page.locator('[data-install-prompt="ios"]');
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText('Zet my.thread op je telefoon');
    await expect(bar).toContainText('Zet op beginscherm');
    await bar.getByRole('button', { name: 'Niet nu' }).click();
    await expect(bar).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-install-prompt]')).toHaveCount(0);
  });

  test('is absent when already installed', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    await page.goto(BASE);
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-install-prompt]')).toHaveCount(0);
  });
});

test.describe('desktop', () => {
  test.use({ userAgent: IPHONE.userAgent, viewport: { width: 1280, height: 800 } });
  test('is absent on a wide screen, even for an iPhone user agent', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-install-prompt]')).toHaveCount(0);
  });
});

test.describe('Android Chrome', () => {
  test.use({ viewport: { width: 412, height: 915 }, locale: 'de-DE' });
  test('waits for the browser, then Install opens its dialog', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-install-prompt]')).toHaveCount(0);
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
      (window as unknown as { prompted: boolean }).prompted = false;
      e.prompt = async () => { (window as unknown as { prompted: boolean }).prompted = true; };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    const bar = page.locator('[data-install-prompt="android"]');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('Installiere my.thread auf deinem Handy');
    await bar.getByRole('button', { name: 'Installieren' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { prompted: boolean }).prompted)).toBe(true);
    await expect(bar).toHaveCount(0);
  });
});
