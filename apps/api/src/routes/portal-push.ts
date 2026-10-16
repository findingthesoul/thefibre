// A participant's devices for web push (docs/web-push-plan.md §5).
//
// Its own file, mounted beside the portal under /me, so the shared portal.ts
// carries no hunk for it. Same scoping as every /me route: the verified email
// behind the participant's bearer token, nothing else — and an email stored
// lower-case (the table's check refuses anything else).
//
//   GET    /me/portal/push/config         { publicKey } — null while push is dark
//   GET    /me/portal/push/subscriptions  this person's devices: label, date, and the endpoint's
//                                         last 12 characters (a hint for "is this one me"), never the endpoint
//   POST   /me/portal/push/subscriptions  { endpoint, keys: { p256dh, auth } } — upsert on endpoint
//   DELETE /me/portal/push/subscriptions  { endpoint } (this device) or { id } (from the list)

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { participantEmailFromAuth } from '../lib/participant-auth.js';
import { deviceLabel, isAllowedEndpoint, vapidConfig } from '../lib/web-push.js';

export const pushRoutes = new Hono();

pushRoutes.get('/portal/push/config', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  return c.json({ publicKey: vapidConfig()?.publicKey ?? null });
});

pushRoutes.get('/portal/push/subscriptions', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const { data, error } = await adminClient
    .from('push_subscription')
    .select('id, device_label, created_at, endpoint')
    .eq('email', email)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[portal/push] list failed', error);
    return c.json({ error: 'could not load devices' }, 500);
  }
  // The browser knows its own endpoint; the tail lets it find itself in the
  // list without the API ever handing a full endpoint back.
  const items = ((data ?? []) as { id: string; device_label: string | null; created_at: string; endpoint: string }[]).map(
    ({ endpoint, ...d }) => ({ ...d, endpoint_hint: endpoint.slice(-12) }),
  );
  return c.json({ items });
});

pushRoutes.post('/portal/push/subscriptions', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  if (!vapidConfig()) return c.json({ error: 'push is not configured' }, 503);
  const body = (await c.req.json().catch(() => ({}))) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  // The allow-list: an endpoint is an address this server will POST to.
  if (!isAllowedEndpoint(body.endpoint)) return c.json({ error: 'endpoint not allowed' }, 400);
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 256 || auth.length > 64) {
    return c.json({ error: 'keys required' }, 400);
  }
  // Upsert on endpoint: re-subscribing a device updates its row; a device
  // handed to someone else who signs in becomes theirs.
  const { data, error } = await adminClient
    .from('push_subscription')
    .upsert(
      {
        email,
        endpoint: body.endpoint,
        p256dh,
        auth,
        device_label: deviceLabel(c.req.header('user-agent')),
        fail_count: 0,
        first_fail_at: null,
      },
      { onConflict: 'endpoint' },
    )
    .select('id, device_label, created_at')
    .single();
  if (error) {
    console.error('[portal/push] subscribe failed', error);
    return c.json({ error: 'could not save this device' }, 500);
  }
  return c.json(data);
});

pushRoutes.delete('/portal/push/subscriptions', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { endpoint?: unknown; id?: unknown };
  let q = adminClient.from('push_subscription').delete().eq('email', email);
  if (typeof body.endpoint === 'string') q = q.eq('endpoint', body.endpoint);
  else if (typeof body.id === 'string') q = q.eq('id', body.id);
  else return c.json({ error: 'endpoint or id required' }, 400);
  // Hard delete — the approved exception to soft delete (2026-10-16): a
  // device that should not be pushed to is not a record of anything.
  const { error } = await q;
  if (error) {
    console.error('[portal/push] remove failed', error);
    return c.json({ error: 'could not remove this device' }, 500);
  }
  return c.json({ ok: true });
});
