// The member page per tier (Sjoerd 2jj), end to end on STAGING as the FIXTURE
// admin, never a person:
//
//   the EDITOR  writes a section for one tier and limits a document to
//               another — both asked of the DATABASE, not the screen;
//   the PORTAL  then shows that member the community intro, the section for
//               the tier they hold, the documents for everyone and for that
//               tier — and NOT the document limited to a tier they don't hold.
//
// The fixture admin is made a member of its own community for the run, so it
// is in the 'exclusive' project (portal-members-list upserts the same row).
// Everything is put back: membership_settings and the member row BY VALUE
// (or removed when there was none), the two tiers by id.

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const TAG = `e2e-tierpage-${Date.now().toString(36)}`;
const SECTION = `Singers read this ${TAG}`;
let workspaceId = '';
let personId = '';
let held = '';
let other = '';
let settingsBefore: Record<string, unknown> | null = null;
let memberBefore: Record<string, unknown> | null = null;
const link = (title: string, tier_ids?: string[]) => ({
  id: randomUUID(),
  title,
  kind: 'link',
  url: 'https://example.com/' + encodeURIComponent(title),
  uploaded_at: new Date().toISOString(),
  ...(tier_ids ? { tier_ids } : {}),
});
let docs: ReturnType<typeof link>[] = [];

test.beforeAll(async () => {
  const db = stagingService();
  const identity = await fixtureIdentity();
  workspaceId = identity.workspaceId;
  const { data: me } = await db.from('person').select('id').eq('workspace_id', workspaceId).ilike('email', identity.email).limit(1).maybeSingle();
  personId = me?.id as string;
  expect(personId, 'the fixture needs a person row of its own').toBeTruthy();

  held = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: `${TAG} singer`, sort_order: -2 }).select('id').single()).data!.id as string;
  other = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: `${TAG} board`, sort_order: -1 }).select('id').single()).data!.id as string;

  const before = await db.from('membership_member').select('*').eq('workspace_id', workspaceId).eq('person_id', personId).maybeSingle();
  memberBefore = before.data ?? null;
  const m = await db
    .from('membership_member')
    .upsert({ workspace_id: workspaceId, person_id: personId, tier_id: held, status: 'active', renews_at: '2099-01-01T00:00:00Z', deleted_at: null }, { onConflict: 'workspace_id,person_id' })
    .select('id');
  if (m.error) throw new Error(`seed member: ${m.error.message}`);

  const s = await db.from('membership_settings').select('*').eq('workspace_id', workspaceId).maybeSingle();
  settingsBefore = s.data ?? null;
  docs = [link(`${TAG} everyone`), link(`${TAG} for singers`, [held]), link(`${TAG} board minutes`)];
  const up = await db
    .from('membership_settings')
    .upsert({ workspace_id: workspaceId, member_page: { intro_html: `<p>Welcome ${TAG}</p>`, documents: docs } }, { onConflict: 'workspace_id' })
    .select('workspace_id');
  if (up.error) throw new Error(`seed page: ${up.error.message}`);
});

test.afterAll(async () => {
  const db = stagingService();
  if (settingsBefore) await db.from('membership_settings').upsert(settingsBefore, { onConflict: 'workspace_id' });
  else await db.from('membership_settings').delete().eq('workspace_id', workspaceId);
  if (memberBefore) await db.from('membership_member').upsert(memberBefore, { onConflict: 'workspace_id,person_id' });
  else await db.from('membership_member').delete().eq('workspace_id', workspaceId).eq('person_id', personId);
  await db.from('membership_tier').delete().in('id', [held, other].filter(Boolean));
  // Read back: nothing of ours is left.
  const { count } = await db.from('membership_tier').select('id', { count: 'exact', head: true }).in('id', [held, other]);
  expect(count).toBe(0);
  const page = (await db.from('membership_settings').select('member_page').eq('workspace_id', workspaceId).maybeSingle()).data;
  expect(JSON.stringify(page ?? {})).not.toContain(TAG);
});

const storedPage = async () =>
  ((await stagingService().from('membership_settings').select('member_page').eq('workspace_id', workspaceId).single()).data?.member_page ?? {}) as {
    tier_intros?: Record<string, string>;
    documents?: { title: string; tier_ids?: string[] }[];
  };

test('a section for one tier, a document for another: saved, and the member sees only theirs', async ({ page }) => {
  test.setTimeout(150_000);
  await landSignedIn(page, HOSTS.membership, 'membership', '/settings/member-page', /\/settings\/member-page|no-access/);
  await waitForHydration(page, 'button, select');

  // Write the singers' section.
  await page.getByLabel('Write for').selectOption({ label: `${TAG} singer` });
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.type(SECTION);
  // Saves when focus leaves the box.
  await page.getByRole('heading', { level: 2, name: 'Documents' }).click();
  await expect.poll(async () => (await storedPage()).tier_intros?.[held] ?? '', { timeout: 20_000 }).toContain(SECTION);

  // Limit the minutes to the board.
  const minutes = page.getByRole('group', { name: `Shown to: ${TAG} board minutes` });
  await minutes.getByRole('button', { name: `${TAG} board` }).click();
  await expect
    .poll(async () => (await storedPage()).documents?.find((d) => d.title === `${TAG} board minutes`)?.tier_ids ?? [], { timeout: 20_000 })
    .toEqual([other]);

  // The portal, as the member holding "singer".
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  await page.goto(`${HOSTS.my}/community/${workspaceId}`);
  await expect(page.getByText(`Welcome ${TAG}`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: `${TAG} singer` })).toBeVisible();
  await expect(page.getByText(SECTION)).toBeVisible();
  await expect(page.getByText(`${TAG} everyone`)).toBeVisible();
  await expect(page.getByText(`${TAG} for singers`)).toBeVisible();
  await expect(page.getByText(`${TAG} board minutes`)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: `${TAG} board` })).toHaveCount(0);
});
