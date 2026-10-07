import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { HOSTS, landSignedIn, stagingService, fixtureIdentity, waitForHydration } from './helpers.js';

// The gallery images for the Zoom Marketplace listing.
//
// Not a test of behaviour: a producer, run on purpose, that writes PNGs into
// docs/zoom-marketplace/ at Zoom's gallery size (1280×720). It is a spec
// because the browser, the staging sign-in and the fixture all already live
// here, and because a screenshot taken by hand is a screenshot nobody can
// take again the same way.
//
// ---------------------------------------------------------------------------
// Everything in these images is OUR OWN fixture data
// ---------------------------------------------------------------------------
// Staging genuinely has a Zoom connection (hello@thethread.app, through the
// development app) and four real bookings with real join links — and none of
// that appears here. A gallery image goes to strangers, so it shows the
// permanent e2e fixture account and a meeting type created for this run, and
// nobody's name, address or meeting is in it.
//
// The one image this CANNOT produce honestly is a confirmation showing a live
// Zoom join link: that needs a booking against a Zoom-connected host, which
// would create a real meeting in the company's Zoom account. That is a
// deliberate act for somebody who owns that account, not a side effect of a
// screenshot run. See the note in docs/zoom-marketplace/README.md.

const OUT = 'docs/zoom-marketplace';
// Zoom's gallery images are 16:9; 1280×720 is the standard they ask for.
const SIZE = { width: 1280, height: 720 };

const MT = {
  name: 'Introductory call',
  slug: `zoom-gallery-${randomUUID().slice(0, 6)}`,
};

let meetingTypeId = '';
let hostSlug = '';
let fixtureHasZoom = false;

/** The staging stripe is ours, not the product's — it would be in every
 *  gallery image and mean nothing to a reviewer. Hidden for the shot only. */
async function hideStagingBar(page: Page): Promise<void> {
  await page.addStyleTag({ content: '[data-environment-bar]{display:none !important}' });
}

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  const service = stagingService();
  const me = await fixtureIdentity();
  const { data: host } = await service
    .from('meet_host')
    .select('id, slug')
    .eq('user_id', me.userRowId)
    .maybeSingle();
  if (!host) throw new Error('the fixture has no Meet host on staging');
  hostSlug = host.slug as string;

  // Zoom is OFFERABLE only to an account that has connected it — the picker
  // disables the option otherwise (apps/meet/.../form.tsx: `disabled:
  // !zoomConnected`). So whether image 2 can exist at all is a fact about
  // this account, not a choice about this spec.
  const { data: conn } = await service
    .from('user_connection')
    .select('zoom_refresh_token')
    .eq('user_id', me.userRowId)
    .maybeSingle();
  fixtureHasZoom = !!conn?.zoom_refresh_token;

  // A meeting type whose location IS Zoom. Created here rather than found, so
  // the image shows a clean, plainly-named example instead of whatever
  // happens to exist on staging that day.
  const { data, error } = await service
    .from('meet_meeting_type')
    .insert({
      workspace_id: me.workspaceId,
      host_id: host.id,
      name: MT.name,
      slug: MT.slug,
      description: 'A first conversation, half an hour, on Zoom.',
      duration_minutes: 30,
      conferencing_provider: 'zoom',
      event_type: 'one_on_one',
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(`meeting type fixture: ${error.message}`);
  meetingTypeId = data!.id as string;
});

test.afterAll(async () => {
  if (meetingTypeId) await stagingService().from('meet_meeting_type').delete().eq('id', meetingTypeId);
});

test.use({ viewport: SIZE });

test('1 — where you connect Zoom', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/integrations/zoom', /\/integrations\/zoom/);
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: /connect zoom/i })).toBeVisible();
  await hideStagingBar(page);
  await page.screenshot({ path: `${OUT}/1-connect-zoom.png` });
});

test('2 — a meeting type that meets on Zoom', async ({ page }) => {
  // Not a failure, and not quietly passing either. An image of the picker
  // with Zoom greyed out and "connect your Zoom account first" underneath is
  // worse than no image in a marketplace gallery, so this stops and says what
  // it would take: a Zoom-connected account. On staging that is
  // hello@thethread.app, whose workspace is a real one — somebody's name in a
  // public gallery image is a decision for them, not for a screenshot run.
  test.skip(
    !fixtureHasZoom,
    'the fixture account has no Zoom connection, so the picker would show Zoom disabled',
  );
  await landSignedIn(page, HOSTS.meet, 'fibre-meet', `/meeting-types/${meetingTypeId}`, /\/meeting-types\//);
  await waitForHydration(page);
  await expect(page.getByText(MT.name).first()).toBeVisible();

  // The editor opens on Basics, where the only occurrence of "Zoom" is the
  // slug in the URL — which is how the first version of this spec passed
  // while producing an image that showed no Zoom at all. Open the tab where
  // the location actually lives.
  await page.getByRole('button', { name: /conferencing/i }).click();
  await hideStagingBar(page);

  // Asserted on the CONTROL, not on the page text, so a stray "zoom" in a
  // slug or a URL cannot satisfy it again.
  const zoomChoice = page.getByText('Zoom', { exact: true }).first();
  await expect(zoomChoice).toBeVisible();
  await page.screenshot({ path: `${OUT}/2-meeting-type-zoom.png` });
});

test('3 — the page somebody books on', async ({ page }) => {
  await page.goto(`${HOSTS.meet}/${hostSlug}/${MT.slug}`, { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
  await expect(page.getByText(MT.name).first()).toBeVisible();
  // The slots arrive after the page does. Without this the image reads
  // "Loading availability…" — which is what the first run produced, and a
  // gallery image of a spinner says the product is slow.
  await expect(page.getByText(/loading availability/i)).toHaveCount(0, { timeout: 20_000 });
  await hideStagingBar(page);
  await page.screenshot({ path: `${OUT}/3-public-booking-page.png` });
});
