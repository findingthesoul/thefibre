// my.thread → You → Profile edits THE profile (Sjoerd, 2026-10-16: "the same
// profile as people would have in the Thread. Not a new profile."), on
// STAGING as the FIXTURE. Every claim is asked of the DATABASE — the one
// identity_profile row, keyed by the fixture's email — and of storage:
//   1. city, website, LinkedIn and the short bio save to identity_profile;
//   2. a link without https is refused in the form, before any save;
//   3. a photo carrying GPS EXIF is stored WITHOUT it, under profiles/<id>/;
//   4. replacing the photo deletes the old file; removing it deletes the new
//      one and clears the column.
// The fixture's own values are read first and written back afterwards; the
// display name (which other specs pin) is never changed.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const TAG = Date.now().toString(36);
const FIELDS = 'id, display_name, short_bio, city, website_url, linkedin_url, photo_url';
type Row = { id: string; display_name: string | null; short_bio: string | null; city: string | null; website_url: string | null; linkedin_url: string | null; photo_url: string | null };
let email = '';
let before: Row | null = null;

const row = async () => (await stagingService().from('identity_profile').select(FIELDS).eq('email', email).single()).data as Row;

// What STORAGE holds in this person's folder. Asked of storage, not of the
// public URL: the storage CDN keeps serving a deleted public file from its
// cache for a while (seen on staging, 2026-10-16: deleted from the bucket,
// still 200 at the URL 20s later), so a URL check proves nothing.
let folder = '';
let objectsBefore: string[] = [];
const objects = async () =>
  ((await stagingService().storage.from('thread-assets').list(folder, { limit: 100 })).data ?? []).map((o) => o.name);
const nameOf = (url: string) => url.split('/').pop()!.split('?')[0]!;

// A small JPEG-shaped file with an EXIF segment naming a GPS position. The
// browser cannot decode it, so it reaches the API as-is and the SERVER's
// strip is what is tested.
function gpsJpeg(): Buffer {
  const seg = (m: number, p: Buffer) => {
    const l = Buffer.alloc(2);
    l.writeUInt16BE(p.length + 2);
    return Buffer.concat([Buffer.from([0xff, m]), l, p]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    seg(0xe1, Buffer.from(`Exif\0\0GPSLatitude 52.3702 ${TAG}`, 'latin1')),
    seg(0xdb, Buffer.alloc(65, 1)),
    seg(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0])),
    seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0xff, 0xd9]),
  ]);
}

test.beforeAll(async () => {
  email = (await fixtureIdentity()).email;
  before = (await stagingService().from('identity_profile').select(FIELDS).eq('email', email).maybeSingle()).data as Row | null;
  if (before?.id) {
    folder = `profiles/${before.id}`;
    objectsBefore = await objects();
  }
});

test.afterAll(async () => {
  if (!email) return;
  const { error } = await stagingService()
    .from('identity_profile')
    .update({
      short_bio: before?.short_bio ?? null,
      city: before?.city ?? null,
      website_url: before?.website_url ?? null,
      linkedin_url: before?.linkedin_url ?? null,
      photo_url: before?.photo_url ?? null,
    })
    .eq('email', email);
  expect(error).toBeNull();
  // Anything this run left in the folder (a run stopped half-way) goes.
  if (folder) {
    const extra = (await objects()).filter((n) => !objectsBefore.includes(n));
    if (extra.length) await stagingService().storage.from('thread-assets').remove(extra.map((n) => `${folder}/${n}`));
    expect((await objects()).filter((n) => !objectsBefore.includes(n))).toEqual([]);
  }
});

test('city, links, short bio and a photo save to the one profile; GPS is stripped; old photos are deleted', async ({ page, request }) => {
  test.setTimeout(180_000);
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  await page.goto(`${HOSTS.my}/you`);
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible({ timeout: 30_000 });
  await waitForHydration(page, 'input, button');
  const form = page.locator('form').filter({ has: page.getByLabel('City') });

  // 2. Refused in the form before a save.
  await form.getByLabel('Website').fill('example.org');
  await expect(form.getByText('Start the link with https://').first()).toBeVisible();

  // 1. Saved.
  const city = `E2E City ${TAG}`;
  await form.getByLabel('City').fill(city);
  await form.getByLabel('Website').fill(`https://example.org/${TAG}`);
  await form.getByLabel('LinkedIn').fill(`https://www.linkedin.com/in/e2e-${TAG}`);
  await form.getByLabel('Short bio').fill(`E2E short ${TAG}`);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form.getByText('Saved')).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => {
      const r = await row();
      return [r.city, r.website_url, r.linkedin_url, r.short_bio];
    }, { timeout: 20_000 })
    .toEqual([city, `https://example.org/${TAG}`, `https://www.linkedin.com/in/e2e-${TAG}`, `E2E short ${TAG}`]);
  // The display name other specs pin is untouched.
  expect((await row()).display_name).toBe(before?.display_name ?? (await row()).display_name);

  // 3. Photo: stored under profiles/<id>/, without the GPS segment.
  const id = (await row()).id;
  folder = `profiles/${id}`;
  await form.locator('input[type="file"]').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: gpsJpeg() });
  await expect.poll(async () => (await row()).photo_url ?? '', { timeout: 30_000 }).toContain(`/profiles/${id}/`);
  const first = (await row()).photo_url!;
  const stored = await request.get(first);
  expect(stored.status()).toBe(200);
  const bytes = (await stored.body()).toString('latin1');
  expect(bytes).not.toContain('GPSLatitude');
  expect(bytes).toContain('JFIF');

  // 4a. Replace: the first file is deleted.
  await form.locator('input[type="file"]').setInputFiles({ name: 'me2.jpg', mimeType: 'image/jpeg', buffer: gpsJpeg() });
  await expect.poll(async () => (await row()).photo_url, { timeout: 30_000 }).not.toBe(first);
  const second = (await row()).photo_url!;
  await expect.poll(async () => (await objects()).includes(nameOf(first)), { timeout: 20_000 }).toBe(false);
  expect(await objects()).toContain(nameOf(second));

  // 4b. Remove, then save: column cleared, file deleted.
  await form.getByRole('button', { name: /Remove/ }).click();
  await form.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await row()).photo_url, { timeout: 20_000 }).toBeNull();
  await expect.poll(async () => (await objects()).includes(nameOf(second)), { timeout: 20_000 }).toBe(false);
});
