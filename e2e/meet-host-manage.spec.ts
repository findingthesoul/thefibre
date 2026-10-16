// The host manages a booking from their OWN screens (regression, 2026-10-16).
//
// v1.254.0 put cancel and reschedule behind the booking's manage token. The
// host's booking dialog links to the guest's public pages for both, and those
// links carried no token — the cancel page fetches and cancels server-side,
// with no session, so a host could no longer cancel their own meeting. The
// host list now hands each row's token to its own host, and the dialog's
// links carry it.
//
// Signed in as the FIXTURE host (nobody), on a throwaway meeting type on the
// fixture's own meet_host; the host's working hours are set for the run and
// put back afterwards. Pinned:
//   · Reschedule in the dialog opens the public page in reschedule mode with
//     the token, and moving the booking there works;
//   · Cancel in the dialog opens the cancel page with the token, and the
//     booking ends cancelled.
// That a guest mail sent from a host action still carries the token is
// pinned in apps/api/src/integration/meet-manage-token.int.test.ts, where the
// mail can be read; here it would only be a Resend send we cannot open.
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const API = 'https://thefibre-api-staging.fly.dev';

test('the host cancels and reschedules from their own booking dialog', async ({ page, context }) => {
  test.setTimeout(240_000);
  const s = stagingService();
  const me = await fixtureIdentity();
  const { data: host, error: hErr } = await s
    .from('meet_host')
    .select('id, slug, working_hours')
    .eq('user_id', me.userRowId)
    .single();
  if (hErr || !host) throw new Error(`fixture meet_host: ${hErr?.message}`);

  const tag = randomUUID().slice(0, 6);
  const guestName = `Host Manage ${tag}`;
  let mtId: string | undefined;
  try {
    const day = { start: '08:00', end: '18:00' };
    await s
      .from('meet_host')
      .update({ working_hours: { mon: [day], tue: [day], wed: [day], thu: [day], fri: [day], sat: [day], sun: [day] } })
      .eq('id', host.id);
    const mtSlug = `e2e-host-manage-${tag}`;
    const { data: mt, error: mErr } = await s
      .from('meet_meeting_type')
      .insert({
        workspace_id: me.workspaceId,
        host_id: host.id,
        slug: mtSlug,
        name: `E2E host manage ${tag}`,
        duration_minutes: 30,
        event_type: 'one_on_one',
        capacity: 1,
        requires_approval: false,
        conferencing_provider: 'none',
        min_notice_minutes: 0,
      })
      .select('id')
      .single();
    if (mErr || !mt) throw new Error(`meeting type: ${mErr?.message}`);
    mtId = mt.id as string;

    // The guest books through the public route, as a guest would.
    const starts = new Date(Date.now() + 14 * 86_400_000);
    starts.setUTCHours(10, 0, 0, 0);
    const r = await fetch(`${API}/api/v1/meet/public/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-ID': 'fibre-meet' },
      body: JSON.stringify({
        meeting_type_id: mtId,
        invitee_email: `delivered+hostmanage-${tag}@resend.dev`,
        invitee_name: guestName,
        starts_at: starts.toISOString(),
        request_id: randomUUID(),
      }),
    });
    expect(r.status, await r.clone().text()).toBeLessThan(300);
    const bookingId = ((await r.json()) as { booking: { id: string } }).booking.id;

    const openDialog = async () => {
      await landSignedIn(page, HOSTS.meet, 'fibre-meet', '/bookings', /\/bookings/);
      const row = page.getByText(guestName).first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      await waitForHydration(page);
      await row.click();
      await expect(page.getByRole('link', { name: 'Cancel this booking' })).toBeVisible({ timeout: 15_000 });
    };

    // 1. Reschedule: the host's link opens the public page with the token,
    //    and moving the booking there works.
    await openDialog();
    const resLink = page.getByRole('link', { name: 'Reschedule this booking' });
    expect(await resLink.getAttribute('href')).toContain(`reschedule=${bookingId}&t=`);
    const [moving] = await Promise.all([context.waitForEvent('page'), resLink.click()]);
    await expect(moving.getByText('Pick a new time')).toBeVisible({ timeout: 30_000 });
    await waitForHydration(moving);
    await moving.getByRole('button', { name: /^\d{1,2}$/ }).first().click();
    await moving.getByRole('button', { name: /^\d{1,2}:\d{2}/ }).first().click();
    await moving.getByRole('button', { name: 'Next', exact: true }).click();
    await moving.getByRole('button', { name: 'Confirm new time' }).click();
    await moving.waitForURL(new RegExp(`/confirmed/${bookingId}\\?t=`), { timeout: 30_000 });
    const moved = (await s.from('meet_booking').select('starts_at, status').eq('id', bookingId).single()).data!;
    expect(new Date(moved.starts_at as string).getTime()).not.toBe(starts.getTime());
    expect(moved.status).toBe('confirmed');
    await moving.close();

    // 2. Cancel: the host's link opens the cancel page with the token (it
    //    reads and cancels server-side, with no session), and it cancels.
    await openDialog();
    const cancelLink = page.getByRole('link', { name: 'Cancel this booking' });
    expect(await cancelLink.getAttribute('href')).toContain(`/cancel/${bookingId}?t=`);
    const [cancelling] = await Promise.all([context.waitForEvent('page'), cancelLink.click()]);
    const button = cancelling.getByRole('button', { name: 'Cancel booking' });
    await expect(button).toBeVisible({ timeout: 30_000 });
    await waitForHydration(cancelling);
    await button.click();
    // The form says "Booking cancelled." and then refreshes, and the refreshed
    // page renders the cancelled booking ("This booking is already
    // cancelled.") — so either may be what is on screen. The status below is
    // the proof.
    await expect(
      cancelling.getByText(/Booking cancelled\. A confirmation|This booking is already cancelled/).first(),
    ).toBeVisible({ timeout: 30_000 });
    const after = (await s.from('meet_booking').select('status').eq('id', bookingId).single()).data!;
    expect(after.status).toBe('cancelled');
  } finally {
    if (mtId) {
      await s.from('meet_booking').delete().eq('meeting_type_id', mtId);
      await s.from('meet_meeting_type').delete().eq('id', mtId);
    }
    await s.from('meet_host').update({ working_hours: host.working_hours }).eq('id', host.id);
  }
});
