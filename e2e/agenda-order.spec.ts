// A thread's dialog lists its agenda in TIME order (2026-10-17: a 12 Jan
// event was listed after 17 Feb — the API sends the organiser's editor order).
// The run adds a session to the fixture member's "Year agenda" thread that is
// EARLIER in time but LAST in the editor (highest position), and deletes it
// afterwards. It must be listed first.

import { expect, test } from '@playwright/test';
import { HOSTS, authUserByEmail, signedInLandUrlFor, stagingService } from './helpers.js';

const EMAIL = 'rehearsal-20260907@example.com';
let seeded: string | null = null;

test.beforeAll(async () => {
  const s = stagingService();
  const { data: persons } = await s.from('person').select('id').eq('email', EMAIL);
  const { data: enrol } = await s
    .from('thread_enrolment')
    .select('thread_id, thread:thread_id (workspace_id)')
    .in('person_id', (persons ?? []).map((p) => p.id))
    .limit(1)
    .single();
  if (!enrol) throw new Error(`${EMAIL} has no thread on staging`);
  const ws = (Array.isArray(enrol.thread) ? enrol.thread[0] : enrol.thread) as { workspace_id: string };
  const { data, error } = await s
    .from('thread_engagement')
    .insert({
      workspace_id: ws.workspace_id,
      thread_id: enrol.thread_id,
      type: 'event',
      title: 'e2e: Earliest, placed last',
      status: 'published',
      starts_at: '2027-01-02T10:00:00Z',
      ends_at: '2027-01-02T11:00:00Z',
      position: 999,
    })
    .select('id')
    .single();
  if (error) throw new Error(`seed session: ${error.message}`);
  seeded = data.id as string;
});

test.afterAll(async () => {
  if (seeded) await stagingService().from('thread_engagement').delete().eq('id', seeded);
});

test('the earliest session comes first, whatever its place in the editor', async ({ page, context }) => {
  test.slow();
  await context.addCookies([{ name: 'thefibre.locale', value: 'en', url: HOSTS.my }]);
  const user = await authUserByEmail(EMAIL);
  await page.goto(await signedInLandUrlFor(HOSTS.thread, 'the-thread', user, '/'));
  await page.waitForLoadState('networkidle');
  await page.goto(`${HOSTS.my}/`);

  const card = page.locator('li').filter({ hasText: 'Conversation 1' }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole('button').first().click();
  const rows = page.getByRole('dialog').locator('section ul > li');
  await expect(rows.first()).toContainText('e2e: Earliest, placed last');
  await expect(rows.nth(1)).toContainText('Conversation 1');
});
