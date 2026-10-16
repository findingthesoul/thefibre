// The Files page (Sjoerd 2ij), end to end on STAGING as the FIXTURE, never a
// person: the fixture is made a member of its own community (tier "singer"),
// whose member page holds a stored file and a link for everyone and a link
// for another tier. On my.thread/files it sees the community heading, the
// file and the everyone-link — not the other tier's — and the file opens
// through the signed proxy: a one-minute address in the private bucket.
//
// Exclusive project: portal-members-list and member-page-tiers upsert the same
// member row. Everything is put back BY VALUE (or removed when there was
// none); the uploaded object and the two tiers by id; read back afterwards.

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService } from './helpers.js';

const TAG = `e2e-files-${Date.now().toString(36)}`;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89]);
let workspaceId = '';
let personId = '';
let held = '';
let other = '';
let objectPath = '';
let settingsBefore: Record<string, unknown> | null = null;
let memberBefore: Record<string, unknown> | null = null;

test.beforeAll(async () => {
  const db = stagingService();
  const identity = await fixtureIdentity();
  workspaceId = identity.workspaceId;
  const { data: me } = await db.from('person').select('id').eq('workspace_id', workspaceId).ilike('email', identity.email).limit(1).maybeSingle();
  personId = me?.id as string;
  expect(personId, 'the fixture needs a person row of its own').toBeTruthy();

  held = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: `${TAG} singer` }).select('id').single()).data!.id as string;
  other = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: `${TAG} board` }).select('id').single()).data!.id as string;

  memberBefore = (await db.from('membership_member').select('*').eq('workspace_id', workspaceId).eq('person_id', personId).maybeSingle()).data ?? null;
  const m = await db
    .from('membership_member')
    .upsert({ workspace_id: workspaceId, person_id: personId, tier_id: held, status: 'active', renews_at: '2099-01-01T00:00:00Z', deleted_at: null }, { onConflict: 'workspace_id,person_id' })
    .select('id');
  if (m.error) throw new Error(`seed member: ${m.error.message}`);

  const fileId = randomUUID();
  objectPath = `${workspaceId}/${fileId}.png`;
  const up = await db.storage.from('member-documents').upload(objectPath, PNG, { contentType: 'image/png', upsert: false });
  if (up.error) throw new Error(`seed file: ${up.error.message}`);

  settingsBefore = (await db.from('membership_settings').select('*').eq('workspace_id', workspaceId).maybeSingle()).data ?? null;
  const at = new Date().toISOString();
  const s = await db
    .from('membership_settings')
    .upsert(
      {
        workspace_id: workspaceId,
        member_page: {
          intro_html: null,
          documents: [
            { id: fileId, title: `${TAG} poster`, path: objectPath, mime: 'image/png', bytes: PNG.length, uploaded_at: at },
            { id: randomUUID(), title: `${TAG} handbook`, kind: 'link', url: 'https://example.com/handbook', uploaded_at: at },
            { id: randomUUID(), title: `${TAG} board minutes`, kind: 'link', url: 'https://example.com/minutes', uploaded_at: at, tier_ids: [other] },
          ],
        },
      },
      { onConflict: 'workspace_id' },
    )
    .select('workspace_id');
  if (s.error) throw new Error(`seed page: ${s.error.message}`);
});

test.afterAll(async () => {
  const db = stagingService();
  if (settingsBefore) await db.from('membership_settings').upsert(settingsBefore, { onConflict: 'workspace_id' });
  else await db.from('membership_settings').delete().eq('workspace_id', workspaceId);
  if (memberBefore) await db.from('membership_member').upsert(memberBefore, { onConflict: 'workspace_id,person_id' });
  else await db.from('membership_member').delete().eq('workspace_id', workspaceId).eq('person_id', personId);
  if (objectPath) await db.storage.from('member-documents').remove([objectPath]);
  await db.from('membership_tier').delete().in('id', [held, other].filter(Boolean));
  // Read back.
  const { count } = await db.from('membership_tier').select('id', { count: 'exact', head: true }).in('id', [held, other]);
  expect(count).toBe(0);
  const page = (await db.from('membership_settings').select('member_page').eq('workspace_id', workspaceId).maybeSingle()).data;
  expect(JSON.stringify(page ?? {})).not.toContain(TAG);
  const { data: left } = await db.storage.from('member-documents').list(workspaceId, { search: objectPath.split('/')[1] });
  expect(left ?? []).toHaveLength(0);
});

test('Files: the community’s documents for my tier, and a file opens through the signed proxy', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  await page.goto(`${HOSTS.my}/files`);
  await expect(page.getByRole('heading', { level: 1, name: 'Files' })).toBeVisible({ timeout: 30_000 });
  const poster = page.getByRole('link', { name: `${TAG} poster` });
  await expect(poster).toBeVisible();
  await expect(page.getByRole('link', { name: `${TAG} handbook` })).toBeVisible();
  await expect(page.getByText(`${TAG} board minutes`)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'From your community' }).first()).toBeVisible();

  // The file: through /community-document, redirected to a signed address
  // in the private bucket — never a lasting one.
  expect(await poster.getAttribute('href')).toMatch(/^\/community-document\//);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/object/sign/member-documents/'), { timeout: 30_000 }),
    poster.click(),
  ]);
  expect(response.status()).toBe(200);
  expect(response.url()).toMatch(/token=/);
});
