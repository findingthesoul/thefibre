// You → Notifications → Your calendar: one-click Google and Outlook.com
// buttons beside Apple's (2026-10-17). The fixture member's own feed; if the
// fixture had no calendar address, this run makes one and stops it again.
// What the buttons OPEN is checked by hand, signed out (lib/calendar-links.ts);
// this checks that each carries this person's feed, in both languages.

import { expect, test } from '@playwright/test';
import { HOSTS, landPortalAsUpcoming } from './helpers.js';

const SHOTS = process.env.SHOTS_DIR;

for (const [lang, labels] of [
  ['en', { google: 'Add to Google Calendar', outlook: 'Add to Outlook.com', subscribe: 'Subscribe', stop: 'Stop the calendar' }],
  ['nl', { google: 'Toevoegen aan Google Agenda', outlook: 'Toevoegen aan Outlook.com', subscribe: 'Abonneren', stop: 'Agenda stoppen' }],
] as const) {
  test(`the calendar card offers Google and Outlook.com (${lang})`, async ({ page, context }) => {
    test.slow();
    await context.addCookies([{ name: 'thefibre.locale', value: lang, url: HOSTS.my }]);
    await page.setViewportSize({ width: 430, height: 1100 });
    await landPortalAsUpcoming(page, '/you?tab=notifications');
    await page.waitForURL(/\/you/, { timeout: 30_000 });

    let created = false;
    const subscribe = page.getByRole('button', { name: labels.subscribe, exact: true });
    if (await subscribe.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await subscribe.click();
      created = true;
    }
    const google = page.getByRole('link', { name: labels.google });
    const outlook = page.getByRole('link', { name: labels.outlook });
    await expect(google).toBeVisible({ timeout: 30_000 });

    const g = new URL((await google.getAttribute('href'))!);
    expect(g.origin).toBe('https://accounts.google.com');
    const cid = new URL(g.searchParams.get('continue')!).searchParams.get('cid')!;
    expect(cid).toMatch(/^webcal:\/\/.+\.ics/);

    const o = new URL((await outlook.getAttribute('href'))!);
    expect(o.origin + o.pathname).toBe('https://outlook.live.com/calendar/0/addfromweb');
    expect(o.searchParams.get('url')).toBe(cid.replace('webcal://', 'https://'));

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/calendar-card-${lang}.png`, fullPage: true });

    if (created) await page.getByRole('button', { name: labels.stop }).click();
  });
}
