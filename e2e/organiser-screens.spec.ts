import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn, stagingService } from './helpers.js';

// The organiser screens that shipped 2026-09-24/25 typechecked-only, on
// STAGING, rendered by a real signed-in browser — the render check testing
// approach §1.5 asks for and none of them had. Written by the stress round
// of 2026-09-25 after four peers said the same thing: "nobody has seen it".
//
// Signed in as the fixture user (e2e/helpers.ts: the oldest confirmed
// staging account), who organises the year-agenda thread in the default
// workspace. Labels are matched in English OR Dutch because the fixture's
// locale is theirs, not ours.

const THREAD = 'f10cf77a-9ca5-4ffa-bc33-cce5d7dd73fe';
const EDITOR = `/threads/${THREAD}`;

/** One queued calendar change on the thread, so the tray has a reason to
 *  exist. Created if the queue is empty; the row is ours and is removed. */
async function ensureQueuedChange(): Promise<string | null> {
  const service = stagingService();
  const { data: pending, error } = await service
    .from('thread_calendar_change')
    .select('id')
    .eq('thread_id', THREAD)
    .is('sent_at', null)
    .limit(1);
  if (error) throw new Error(`calendar queue read: ${error.message}`);
  if (pending?.length) return null;
  const { data: t, error: tErr } = await service
    .from('thread_thread')
    .select('workspace_id')
    .eq('id', THREAD)
    .single();
  if (tErr) throw new Error(`thread read: ${tErr.message}`);
  const { data: made, error: mErr } = await service
    .from('thread_calendar_change')
    .insert({
      workspace_id: t!.workspace_id,
      thread_id: THREAD,
      engagement_id: null,
      kind: 'cancelled',
      title: 'e2e: a session that was cancelled',
      was: { starts_at: '2026-10-01T09:00:00Z' },
      now_state: null,
    })
    .select('id')
    .single();
  if (mErr) throw new Error(`calendar queue fixture: ${mErr.message}`);
  return made!.id as string;
}

test.describe('Thread editor — calendar tray (v1.49.0/1.51.0)', () => {
  let ours: string | null = null;
  test.beforeAll(async () => {
    ours = await ensureQueuedChange();
  });
  test.afterAll(async () => {
    if (ours) await stagingService().from('thread_calendar_change').delete().eq('id', ours);
  });

  test('the bar shows what is owed and opens the review dialog', async ({ page }) => {
    await landSignedIn(page, HOSTS.thread, 'the-thread', EDITOR, /\/threads\//);
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
    await landSignedIn(page, HOSTS.thread, 'the-thread', EDITOR, /\/threads\//);
    const badge = page.getByText(/^(Sends the ticket|Stuurt het ticket)$/);
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
    await landSignedIn(page, HOSTS.thread, 'the-thread', EDITOR, /\/threads\//);
    await page.locator('button[title="Registrations"], button[title="Registraties"]').click();
    await page.getByRole('button', { name: /Add participant|Deelnemer toevoegen/ }).click();

    const form = page.locator('form#add-participant-form');
    await expect(form).toBeVisible();
    // The combobox is a button that opens a search box.
    await form.getByRole('button', { name: /Search by name or email|Zoek op naam of e-mail/ }).click();
    const search = form.locator('input[placeholder*="name or email"], input[placeholder*="naam of e-mail"]').first();
    await search.fill('coop1');
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
