// my.thread → Upcoming, seen as a member of two communities.
//
// Every surface of thread dates slice 4 was looked at on staging except this
// one, because the only account the pack could sign in as had no community.
// E2E_UPCOMING has two (e2e/identities.ts says how they are seeded). This
// adds ONE key moment to one of the seeded threads for the run, opens
// Upcoming, and asserts that the row reads its dates through the shared rule
// — the key-moment day, not the thread's start date it printed before — and
// that both communities are on the page.

import { expect, test } from '@playwright/test';
import { landPortalAsUpcoming, stagingService } from './helpers.js';

let engagementId = '';
let title = '';

test.beforeAll(async () => {
  const s = stagingService();
  const { data: t, error } = await s
    .from('thread_thread')
    .select('id, workspace_id, program:program_id (title)')
    .eq('slug', 'fixture-band-listed')
    .maybeSingle();
  if (error || !t) throw new Error('the seeded Band thread is missing — run apps/api/scripts/seed-upcoming-fixture.mjs');
  title = ((Array.isArray(t.program) ? t.program[0] : t.program) as { title: string }).title;
  const e = await s
    .from('thread_engagement')
    .insert({
      workspace_id: t.workspace_id, thread_id: t.id, type: 'event', title: 'e2e: key moment', status: 'published',
      starts_at: '2027-02-14T18:00:00Z', ends_at: '2027-02-14T20:00:00Z', is_key_moment: true, position: 997,
    })
    .select('id')
    .single();
  if (e.error) throw new Error(`key moment: ${e.error.message}`);
  engagementId = e.data.id as string;
});

test.afterAll(async () => {
  if (engagementId) await stagingService().from('thread_engagement').delete().eq('id', engagementId);
});

test('Upcoming lists both communities, and a row reads its key-moment date', async ({ page }) => {
  test.slow();
  await landPortalAsUpcoming(page, '/upcoming');
  await page.waitForURL(/\/upcoming/, { timeout: 30_000 });

  const row = page.getByRole('listitem').filter({ hasText: title });
  await expect(row, `the Band thread "${title}" is listed`).toBeVisible({ timeout: 30_000 });
  // The key moment's day — the dates the community's card choice shows by
  // default — not the thread's own start date.
  await expect(row).toContainText('14 Feb 2027');
  // Both communities, by their calendars.
  await expect(page.getByText(/Choir/).first()).toBeVisible();
  await expect(page.getByText(/Band/).first()).toBeVisible();
});
