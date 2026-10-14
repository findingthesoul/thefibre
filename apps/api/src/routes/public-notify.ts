// POST /api/v1/public/notify/unsubscribe — the "Stop these emails" link.
//
// Signed out, by design: the link is in an email, and asking somebody to sign
// in to stop being emailed is the pattern people rightly resent. The token is
// the authority — random, per person, minted by lib/member-notify.ts — and it
// can only ever turn email OFF for that one person in that one community.
//
// POST, never GET. Mail scanners and link previews FETCH every link in a
// message; an unsubscribe on GET would unsubscribe people who never clicked.
// The my.thread page the email links to shows one button that posts here.

import { Hono } from 'hono';
import { adminClient } from '../db.js';

export const publicNotifyRoutes = new Hono();

publicNotifyRoutes.post('/unsubscribe', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!/^[0-9a-f]{48}$/.test(token)) return c.json({ error: 'not found' }, 404);
  const { data, error } = await adminClient
    .from('member_notification_pref')
    .update({ email_off: true, updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('workspace:workspace_id (name)')
    .maybeSingle();
  if (error || !data) return c.json({ error: 'not found' }, 404);
  const ws = Array.isArray(data.workspace) ? data.workspace[0] : data.workspace;
  return c.json({ ok: true, community: (ws as { name?: string } | null)?.name ?? null });
});
