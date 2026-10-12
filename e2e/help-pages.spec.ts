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
  test(`${name}: Help renders, lists guides, and EVERY link is a real page`, async ({ page }) => {
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

    // EVERY link, not only the first.
    //
    // It checked `guides.first()` until 2026-10-12, which is a check that
    // cannot fail for the reason it exists: a stale link is nearly always one
    // somebody added later, and later means further down. The Fibre's Help
    // lists nineteen; the first was the only one anybody looked at.
    const hrefs = [
      ...new Set(
        (await guides.evaluateAll((els) =>
          els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''),
        )).filter(Boolean),
      ),
    ];
    expect(hrefs.length, `${name}: no guide links found`).toBeGreaterThan(3);

    // Collected, then reported together: failing on the first bad link tells
    // somebody to fix one and come back, when the useful answer is all of
    // them at once.
    const broken: string[] = [];
    for (const href of hrefs) {
      // A redirect to sign-in would be a 200 of the wrong page; the request
      // context shares the browser's cookies, so this is the signed-in answer.
      const res = await page.request.get(`${host}${href}`);
      if (res.status() >= 400) broken.push(`${href} → ${res.status()}`);
    }
    expect(broken, `${name}: guide links that do not resolve`).toEqual([]);
    await expect(page.locator('body')).not.toContainText('404');
  });
}
