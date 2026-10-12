import { test, expect } from '@playwright/test';
import { HOSTS, fixtureThread, landSignedIn, stagingService } from './helpers.js';

// The organiser screens that shipped 2026-09-24/25 typechecked-only, on
// STAGING, rendered by a real signed-in browser — the render check testing
// approach §1.5 asks for and none of them had. Written by the stress round
// of 2026-09-25 after four peers said the same thing: "nobody has seen it".
//
// EVERYTHING HERE RUNS AS THE FIXTURE NOW (2026-10-12). The three
// thread-editor checks used to sign in as the OWNER of the `default`
// workspace — a real person — and open the year-agenda thread he organises,
// because that was the only thread with a tray worth looking at. Two things
// were wrong with that:
//
//   1. it minted a session as him on every run, which is not a test's
//      decision to make (Sjoerd, 2026-10-12: "owner tests opt-in"); and
//   2. the calendar fixture WROTE a queued change into his workspace. It
//      never actually did — it only inserts when the queue is empty, and his
//      has had a change parked since 2026-09-24 — but a send takes EVERY
//      pending change on a thread, so a leftover row would have gone out with
//      his next real send, to all sixteen enrolled people.
//
// The fixture now has a thread of its own (e2e/identities.ts,
// `ensureFixtureThread`): nobody's data, NO enrolments at all, and a session
// in November 2027. A send from this thread could reach no one even if a
// spec pressed it, which no spec does.
//
// Labels are English only now: the fixture has no locale preference, so its
// interface is English. The owner's was his own, which is why this file used
// to match either language.

/** One queued calendar change on the FIXTURE's thread, so the tray has a
 *  reason to exist. Returns the row's id, which afterAll removes. */
async function queueOneChange(threadId: string, sessionId: string, workspaceId: string): Promise<string | null> {
  const service = stagingService();
  const { data: pending, error } = await service
    .from('thread_calendar_change')
    .select('id')
    .eq('thread_id', threadId)
    .is('sent_at', null)
    .limit(1);
  if (error) throw new Error(`calendar queue read: ${error.message}`);
  // Left over from a run that was killed before its afterAll. Reused rather
  // than added to, and removed at the end like one of ours — in the
  // fixture's own thread that is tidying, not meddling.
  if (pending?.length) return pending[0]!.id as string;
  const { data: made, error: mErr } = await service
    .from('thread_calendar_change')
    .insert({
      workspace_id: workspaceId,
      thread_id: threadId,
      engagement_id: sessionId,
      kind: 'cancelled',
      title: 'e2e: a session that was cancelled',
      was: { starts_at: '2027-11-02T10:00:00Z' },
      now_state: null,
    })
    .select('id')
    .single();
  if (mErr) throw new Error(`calendar queue fixture: ${mErr.message}`);
  return made!.id as string;
}

test.describe('Thread editor — calendar tray (v1.49.0/1.51.0)', () => {
  let ours: string | null = null;
  let editor = '';
  test.beforeAll(async () => {
    const t = await fixtureThread();
    editor = `/threads/${t.threadId}`;
    const { data: ws } = await stagingService()
      .from('thread_thread')
      .select('workspace_id')
      .eq('id', t.threadId)
      .single();
    ours = await queueOneChange(t.threadId, t.sessionId, ws!.workspace_id as string);
  });
  test.afterAll(async () => {
    if (ours) await stagingService().from('thread_calendar_change').delete().eq('id', ours);
  });

  test('the bar shows what is owed and opens the review dialog', async ({ page }) => {
    await landSignedIn(page, HOSTS.thread, 'the-thread', editor, /\/threads\//);
    const bar = page.getByText(/not sent\./);
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Review and send' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Tell people what changed');
    await expect(dialog.locator('li').first()).toBeVisible();
    // Close without sending: this is a render check, not a send.
    await dialog.getByRole('button', { name: 'Not yet' }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('Thread editor — the ticket badge (v1.49.2)', () => {
  test('exactly one message says it sends the ticket', async ({ page }) => {
    const t = await fixtureThread();
    await landSignedIn(page, HOSTS.thread, 'the-thread', `/threads/${t.threadId}`, /\/threads\//);
    // ONE, and the fixture thread is the sharper place to check it: opening
    // the editor runs ensureSystemEngagements every time, so this asserts
    // that a seeded row it already has is not seeded again.
    const badge = page.getByText(/^Sends the ticket$/);
    await expect(badge.first()).toBeVisible({ timeout: 30_000 });
    await expect(badge).toHaveCount(1);
  });
});

test.describe('Registrations → Add participant — the person search (v1.52.0)', () => {
  test('picking somebody fills the name AND the email', async ({ page }) => {
    // Three round trips to a cold Vercel function before the first click;
    // the first run of the day timed out at the default 45 s and passed on
    // its retry. The check is right; the budget was not.
    test.slow();
    const t = await fixtureThread();
    await landSignedIn(page, HOSTS.thread, 'the-thread', `/threads/${t.threadId}`, /\/threads\//);
    // The editor is server-rendered, so the Registrations button is on the
    // page before React has attached its handler, and a click in that window
    // does nothing at all. Three runs in a row waited ninety seconds for a
    // dialog that had never been asked to open (2026-10-01). So: click until
    // the dialog answers. Each attempt clicks only while it is closed — once
    // it is up, the button sits behind the overlay and a click would hang.
    const registrations = page.locator('button[title="Registrations"]');
    const add = page.getByRole('button', { name: /Add participant/ });
    await expect(async () => {
      if (!(await add.isVisible())) await registrations.click();
      await expect(add).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 45_000 });
    await add.click();

    const form = page.locator('form#add-participant-form');
    await expect(form).toBeVisible();
    // The combobox is a button that opens a search box.
    await form.getByRole('button', { name: /Search by name or email/ }).click();
    const search = form.locator('input[placeholder*="name or email"]').first();
    // The fixture's own searchable person (e2e/identities.ts). Searching by
    // SURNAME, so the match is a name match and the row still has to show an
    // address — which is what the test is about.
    await search.fill('Searchable');
    // A real row from the workspace — the one whose hint is an address — and
    // not the "add as someone new" row, which appears instantly, before the
    // search answers, and is what a name-only match picks up first.
    const option = form.locator('ul li button').filter({ hasText: '@' }).first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();

    await expect(form.locator('input[name="name"]')).not.toHaveValue('');
    await expect(form.locator('input[name="email"]')).toHaveValue(/@/);
  });
});

test.describe('Fibre → Settings → Connections — build a thread from a document (v1.55.0)', () => {
  test('the card is there, collapsed, and opens with a copy button', async ({ page }) => {
    await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/connections', /\/settings\/connections/);
    const card = page.getByRole('button', {
      name: /Build a thread from a document|Maak een thread van een document/,
    });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveAttribute('aria-expanded', 'false');
    await card.click();
    await expect(card).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: /Copy|Kopieer/ }).first()).toBeVisible();
  });
});
