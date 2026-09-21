// Which calendars feed my agenda — read and set.
//
// Sjoerd, 2026-09-21: *"In the interface: select agenda's available to me.
// And select one or more. Maybe popup. And then put agenda's on and off."*
//
// ── Whose calendars ────────────────────────────────────────────────────────
//
// The signed-in person's own, always. Both routes key on ctx.userId and there
// is no way to name another user, for the same reason the agenda route gives:
// "who is in my day" is not a workspace-level fact, so an admin has no more
// right to it than a colleague. An app key has no user and is refused.
//
// The stored rows are resolved against Google's live list in
// lib/agenda-calendars.ts — an absent row means the default, which is on for
// a calendar you own and off for one you merely subscribe to.
//
// MOUNT AT `/connections`:
//     v1.route('/connections', connectionsCalendarsRoutes);

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { userGoogleToken } from '../lib/connections.js';
import { agendaCalendars } from '../lib/agenda-calendars.js';

export const connectionsCalendarsRoutes = new Hono();

connectionsCalendarsRoutes.get('/calendars', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const token = await userGoogleToken(ctx.userId);
  // Not connected is not an error — same as the agenda. The picker says so
  // rather than showing an empty list, which would read as "you have none".
  if (!token) return c.json({ connected: false, calendars: [] });

  try {
    const calendars = await agendaCalendars(token, ctx.workspaceId, ctx.userId);
    return c.json({ connected: true, calendars });
  } catch (e) {
    console.warn('[connections/calendars] list failed', (e as Error).message);
    return c.json({ connected: true, unavailable: true, calendars: [] });
  }
});

const CalendarChoice = z.object({
  calendars: z
    .array(z.object({ id: z.string().min(1).max(300), enabled: z.boolean() }))
    .min(1)
    .max(200),
});

/**
 * Store the whole picker, not the delta. The client sends every calendar it
 * showed, so after a save the stored set is complete and "absent means
 * default" only applies to a calendar made AFTER the choice — which is
 * exactly when the default is the right answer again.
 */
connectionsCalendarsRoutes.put('/calendars', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const body = CalendarChoice.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  // Nothing is validated against Google here. An id that no longer exists is
  // inert (the migration says so), and a round trip to Google to reject a
  // stale row would make saving fail for the one person whose calendar was
  // deleted while the dialog was open.
  const rows = body.data.calendars.map((cal) => ({
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    calendar_id: cal.id,
    enabled: cal.enabled,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await adminClient
    .from('connections_agenda_calendar')
    .upsert(rows, { onConflict: 'workspace_id,user_id,calendar_id' });
  if (error) {
    console.error('[connections/calendars] save failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message }, 500);
  }

  return c.json({ ok: true, saved: rows.length });
});
