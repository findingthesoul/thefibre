// Web push devices, in process on the staging database (routes/portal-push.ts).
//
// A real session for a FIXTURE address, and a throwaway VAPID pair made here —
// never a stack's real keys. The device registered is an endpoint on an
// allowed host that no browser owns; nothing is ever sent to it (the pass is
// not run here). Every row this writes is removed in afterAll.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import webpush from 'web-push';
import { anonKey, url } from './staging.js';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const EMAIL = 'upcoming-fixture@example.com';
const ENDPOINT = `https://fcm.googleapis.com/fcm/send/e2e-builder5-${Date.now()}`;
let app: Hono;
let token = '';

async function tokenFor(email: string): Promise<string> {
  if (!/@example\.com$/i.test(email)) throw new Error(`refusing a non-fixture address: ${email}`);
  const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const hash = link.hashed_token ?? link.properties?.hashed_token;
  if (!hash) throw new Error(`generate_link: ${JSON.stringify(link).slice(0, 200)}`);
  const v = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hash }),
  }).then((r) => r.json());
  if (!v.access_token) throw new Error(`verify: ${JSON.stringify(v).slice(0, 200)}`);
  return v.access_token as string;
}

function call(method: string, path: string, body?: unknown, auth = true) {
  return app.request(`/api/v1/me${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  const { pushRoutes } = await import('../routes/portal-push.js');
  app = new Hono().route('/api/v1/me', pushRoutes);
  token = await tokenFor(EMAIL);
});

afterAll(async () => {
  const { adminClient } = await import('../db.js');
  await adminClient.from('push_subscription').delete().eq('endpoint', ENDPOINT);
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe('/me/portal/push', () => {
  it('refuses without a session', async () => {
    expect((await call('GET', '/portal/push/config', undefined, false)).status).toBe(401);
  });

  it('hands out the public key, and nothing else', async () => {
    const r = await call('GET', '/portal/push/config');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ publicKey: process.env.VAPID_PUBLIC_KEY });
  });

  it('refuses an endpoint that is not a push service', async () => {
    const r = await call('POST', '/portal/push/subscriptions', {
      endpoint: 'https://169.254.169.254/latest/meta-data',
      keys: { p256dh: 'x', auth: 'y' },
    });
    expect(r.status).toBe(400);
  });

  it('registers a device, lists it by label and tail only, and removes it', async () => {
    const add = await call('POST', '/portal/push/subscriptions', { endpoint: ENDPOINT, keys: { p256dh: 'pk', auth: 'au' } });
    expect(add.status).toBe(200);
    const list = (await (await call('GET', '/portal/push/subscriptions')).json()) as {
      items: { id: string; device_label: string; endpoint_hint: string; endpoint?: string }[];
    };
    const mine = list.items.find((d) => d.endpoint_hint === ENDPOINT.slice(-12));
    expect(mine, 'the device is listed').toBeTruthy();
    expect(mine!.device_label).toBe('iPhone · Safari');
    expect(mine!.endpoint, 'never the endpoint itself').toBeUndefined();

    // Stored lower-case, as the table insists.
    const { adminClient } = await import('../db.js');
    const row = await adminClient.from('push_subscription').select('email').eq('endpoint', ENDPOINT).single();
    expect(row.data?.email).toBe(EMAIL);

    const del = await call('DELETE', '/portal/push/subscriptions', { id: mine!.id });
    expect(del.status).toBe(200);
    const gone = await adminClient.from('push_subscription').select('id').eq('endpoint', ENDPOINT);
    expect(gone.data).toEqual([]);
  });
});
