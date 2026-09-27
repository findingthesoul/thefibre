import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn } from './helpers.js';

// v1.77.0: every app's Help is a task-by-task manual. This is its render
// check — signed in, because every (app) route answers 307 to a stranger,
// so an anonymous 200 would fail everywhere and an anonymous 307 would pass
// with the page gone (thefibre-83, 2026-09-27).
//
// One assertion shape for every app: the page has a heading, offers at
// least one guide, and the first guide's link resolves in THIS app to a page
// (not a 404). The link targets were all checked statically in the stress
// round of 2026-09-27; this keeps them checked as the routes move.

const APPS = [
  ['The Fibre', HOSTS.fibre, 'fibre-platform'],
  ['Thread', HOSTS.thread, 'the-thread'],
  ['Meet', HOSTS.meet, 'fibre-meet'],
  ['Flow', HOSTS.flow, 'fibre-flow'],
  ['Pulse', HOSTS.pulse, 'fibre-pulse'],
  ['Members', HOSTS.membership, 'membership'],
] as const;

for (const [name, host, slug] of APPS) {
  test(`${name}: Help renders, lists guides, and its first link is a real page`, async ({ page }) => {
    test.slow();
    // The fixture user may hold no seat for this app; then the shell sends
    // them to /no-access and there is nothing to check here. Say so — the
    // first run waited for /help on Flow and Pulse and timed out instead.
    // Members bounces a seatless account to the portal HOST, not to
    // /no-access, so that is a third place the landing can end.
    await landSignedIn(page, host, slug, '/help', /\/help|no-access|my\.thefibre/);
    if (!/\/help/.test(page.url())) test.skip(true, `fixture user holds no ${name} seat`);

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
    const guides = page.locator('main a[href^="/"], a[href^="/"]').filter({ hasNotText: /^$/ });
    expect(await guides.count()).toBeGreaterThan(3);

    const first = guides.first();
    const href = await first.getAttribute('href');
    expect(href).toBeTruthy();
    const res = await page.request.get(`${host}${href}`);
    // A redirect to sign-in would be a 200 of the wrong page; the request
    // context shares the browser's cookies, so this is the signed-in answer.
    expect(res.status(), `${name} ${href}`).toBeLessThan(400);
    await expect(page.locator('body')).not.toContainText('404');
  });
}
