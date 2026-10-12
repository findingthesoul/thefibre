// The portal's member list, and the bio that was showing its own tags.
//
// Sjoerd, 2026-10-12, on PRODUCTION at my.thethread.app/members/<workspace>,
// looking at his own card: *"Does not wokr like this. Should e a list. Name,
// photo, location... Email and phone"*, and then *"Click on user - full
// bio"*. His card was printing the whole bio as text, and every stored bio is
// HTML now, so what he saw was
// "<p>Zierikzee, Netherlands · Co-founder…</p><p><br></p><h3>About me</h3>".
//
// So this checks the two halves of the fix, on a deployed stack, at both
// widths — the one thing that would have caught it:
//
//   the LIST  shows name, place and contact, and NO markup anywhere;
//   the PAGE  shows the full bio RENDERED: a real <h3>, no literal tags.
//
// It signs in as the fixture, never the owner, and seeds its own community —
// the fixture deliberately ships without one. Everything it creates it
// removes, and `membership_settings` is RESTORED rather than cleared, since
// another spec may have left its own values there.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, fixtureThread, landSignedIn, stagingService } from './helpers.js';

/** Sign in, then walk to the portal.
 *
 *  The portal serves no `/sso/land` — it is a participant surface, not an app
 *  with a hop (apps/my/lib/app-access.ts). What it has instead is the same
 *  apex: a session minted on thread.thefibre.tech is carried to
 *  my.thefibre.tech on the shared auth cookie, which is how a member reaches
 *  it in the first place. So this lands where the helper can land, and then
 *  navigates. */
async function landPortal(page: import('@playwright/test').Page, next: string): Promise<void> {
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  await page.goto(`${HOSTS.my}${next}`);
  await page.waitForURL(new RegExp(next.replace(/\//g, '\\/')), { timeout: 30_000 });
}

const TAG = 'e2e-portal-directory';
let workspaceId = '';
let tierId = '';
let viewerPersonId = '';
let memberPersonId = '';
let settingsBefore: Record<string, unknown> | null = null;
let hadSettings = false;

test.beforeAll(async () => {
  const service = stagingService();
  const identity = await fixtureIdentity();
  // The fixture thread's builder is what creates the two people this needs:
  // the viewer's own person row, and a member whose bio is HTML.
  const t = await fixtureThread();
  workspaceId = identity.workspaceId;

  const people = await service
    .from('person')
    .select('id, email')
    .eq('workspace_id', workspaceId)
    .in('email', [identity.email, t.personEmail]);
  if (people.error) throw new Error(`seed people: ${people.error.message}`);
  viewerPersonId = (people.data ?? []).find((p) => String(p.email).toLowerCase() === identity.email)
    ?.id as string;
  memberPersonId = (people.data ?? []).find(
    (p) => String(p.email).toLowerCase() === t.personEmail,
  )?.id as string;
  // Said out loud: without both, every assertion below would be about an
  // empty list, which is the empty that reads as working.
  expect(viewerPersonId, 'the fixture needs a person row of its own').toBeTruthy();
  expect(memberPersonId, 'the fixture needs somebody to list').toBeTruthy();

  const tier = await service
    .from('membership_tier')
    .insert({ workspace_id: workspaceId, name: `${TAG} tier` })
    .select('id')
    .single();
  if (tier.error) throw new Error(`seed tier: ${tier.error.message}`);
  tierId = tier.data.id as string;

  for (const personId of [viewerPersonId, memberPersonId]) {
    const m = await service
      .from('membership_member')
      .upsert(
        { workspace_id: workspaceId, person_id: personId, tier_id: tierId, status: 'active' },
        { onConflict: 'workspace_id,person_id' },
      )
      .select('id');
    if (m.error) throw new Error(`seed membership: ${m.error.message}`);
    const e = await service
      .from('membership_directory_entry')
      .upsert(
        { workspace_id: workspaceId, person_id: personId, listed: true, show_contact: true },
        { onConflict: 'workspace_id,person_id' },
      )
      .select('person_id');
    if (e.error) throw new Error(`seed directory entry: ${e.error.message}`);
  }

  const existing = await service
    .from('membership_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (existing.error) throw new Error(`read settings: ${existing.error.message}`);
  hadSettings = Boolean(existing.data);
  settingsBefore = existing.data ?? null;
  const on = await service
    .from('membership_settings')
    .upsert(
      {
        workspace_id: workspaceId,
        directory_enabled: true,
        directory_visibility: 'everybody',
        directory_show_contact: true,
      },
      { onConflict: 'workspace_id' },
    )
    .select('workspace_id');
  if (on.error) throw new Error(`seed settings: ${on.error.message}`);
});

test.afterAll(async () => {
  const service = stagingService();
  for (const personId of [viewerPersonId, memberPersonId].filter(Boolean)) {
    await service
      .from('membership_directory_entry')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('person_id', personId);
    await service
      .from('membership_member')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('person_id', personId);
  }
  if (tierId) await service.from('membership_tier').delete().eq('id', tierId);
  // Put the settings back as they were, rather than switching the directory
  // off: "off" is a value too, and it may not have been this spec's to set.
  if (hadSettings && settingsBefore) {
    await service.from('membership_settings').upsert(settingsBefore, { onConflict: 'workspace_id' });
  } else if (!hadSettings) {
    await service.from('membership_settings').delete().eq('workspace_id', workspaceId);
  }
});

for (const [label, width, height] of [
  ['phone', 375, 812],
  ['desktop', 1280, 900],
] as const) {
  test(`${label}: the member list is a list, with no markup in it`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height });
    await landPortal(page, `/members/${workspaceId}`);

    // The member is there, as a row.
    const row = page.getByRole('link', { name: /Esther Searchable/ });
    // ONE link per member, which is the shape itself: the card this replaces
    // had two (an avatar link and a name link) and a row that was mostly not
    // tappable. If this ever resolves to two again, the row has grown an
    // inner anchor and the phone list is broken.
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible({ timeout: 30_000 });

    // Name, place and contact — what Sjoerd asked a row to carry.
    await expect(row).toContainText('Esther Searchable');
    await expect(row).toContainText('Zierikzee');
    await expect(row).toContainText('e2e-searchable@example.com');

    // AND NO MARKUP. The assertion that would have caught the bug: not "the
    // bio renders nicely" but "there are no tags on this page".
    const body = page.locator('body');
    await expect(body).not.toContainText('<p>');
    await expect(body).not.toContainText('</p>');
    await expect(body).not.toContainText('<h3>');
    await expect(body).not.toContainText('<br>');
    // The bio is not in the list at all now, in any form.
    await expect(body).not.toContainText('Fixture member with a RICH TEXT bio');

    // The whole row is the link, not four characters of it: on a phone that
    // is the difference between a list you can use and one you cannot.
    //
    // Measured against the LIST, not the viewport. The first version of this
    // compared the row to the window width and failed at 1280 — correctly:
    // on a desktop the list is a card in a page with a rail beside it, and a
    // row that spanned the WINDOW would mean the card had broken. What must
    // be true at both widths is that the row fills its own list.
    const box = await row.boundingBox();
    const list = await page.locator('ul').filter({ has: row }).first().boundingBox();
    expect(box, 'the row has a box').toBeTruthy();
    expect(list, 'the list has a box').toBeTruthy();
    expect(box!.width, 'the tappable row fills its list').toBeGreaterThan(list!.width * 0.95);
    expect(box!.height, 'and is at least a finger high').toBeGreaterThanOrEqual(44);
    // And on a phone the list itself reaches the glass: ROW_LIST cancels the
    // page gutter, which is the whole reason the shell moved to px-4.
    if (width < 768) {
      expect(list!.x, 'the list starts at the screen edge').toBeLessThanOrEqual(1);
      expect(list!.width, 'and is as wide as the screen').toBeGreaterThanOrEqual(width - 1);
    }
  });

  test(`${label}: the member page shows the full bio, rendered`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height });
    await landPortal(page, `/members/${workspaceId}`);
    await page.getByRole('link', { name: /Esther Searchable/ }).click();
    await page.waitForURL(new RegExp(`/members/${workspaceId}/`), { timeout: 30_000 });

    // The full bio, as TEXT the reader can read…
    const body = page.locator('body');
    await expect(body).toContainText('Fixture member with a RICH TEXT bio');
    await expect(body).toContainText('Two paragraphs and a heading');
    // …with its heading as a real element, not as four characters of markup.
    await expect(page.locator('h3', { hasText: 'About me' })).toBeVisible();
    await expect(body).not.toContainText('<p>');
    await expect(body).not.toContainText('<h3>');

    // The contact details are real links here, which is why the list shows
    // them as text: an anchor inside the row's anchor is the thing that
    // misbehaves.
    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
  });
}
