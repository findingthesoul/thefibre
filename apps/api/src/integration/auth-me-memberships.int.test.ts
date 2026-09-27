// /auth/me must return EVERY app membership the workspace has switched on —
// and say so loudly when it cannot read them.
//
// Written 2026-09-27 during stress round 3, when a super admin with eight
// grants on staging was refused Flow and Pulse and lost the workspace-admin
// gate on The Fibre's Teams screen, while Thread and Meet still worked. The
// route reads app_membership under the caller's OWN token and turned any
// failure into `[]` (rawMemberships ?? []): a partial answer looks exactly
// like a smaller set of rights. This pins the full set for a fixture that
// holds the same mix (member + admin, direct grants, every app activated).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

const WANT: Record<string, string> = {
  'the-thread': 'member',
  'fibre-meet': 'member',
  'fibre-flow': 'admin',
  'fibre-pulse': 'member',
  membership: 'admin',
  'fibre-platform': 'admin',
};

let app: Hono;
let ws: string;
let u: FixtureUser;
const appIds = new Map<string, string>();

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { authRoutes } = await import('../routes/auth.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/auth', authRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('auth-me');
  u = await createFixtureUser(ws, 'auth-me');
  const { error: wmErr } = await service
    .from('workspace_member')
    .upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'super_admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);

  const { data: apps, error } = await service.from('app').select('id, slug').in('slug', Object.keys(WANT));
  if (error) throw new Error(`apps: ${error.message}`);
  for (const a of apps ?? []) appIds.set(a.slug as string, a.id as string);
  for (const [slug, role] of Object.entries(WANT)) {
    const appId = appIds.get(slug);
    if (!appId) throw new Error(`no app row for ${slug}`);
    if (slug !== 'fibre-platform') {
      const { error: waErr } = await service
        .from('workspace_app')
        .upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
      if (waErr) throw new Error(`workspace_app ${slug}: ${waErr.message}`);
    }
    const { error: amErr } = await service
      .from('app_membership')
      .upsert({ user_id: u.userId, app_id: appId, role, is_direct: true }, { onConflict: 'user_id,app_id' });
    if (amErr) throw new Error(`app_membership ${slug}: ${amErr.message}`);
  }
}, 60_000);

afterAll(async () => {
  if (u) {
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('GET /auth/me', () => {
  it('returns every activated membership with its role', async () => {
    const res = await app.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${u.accessToken}`, 'X-App-ID': 'fibre-platform' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      memberships: { role: string; app: { slug: string } | { slug: string }[] | null }[];
    };
    const got = new Map(
      body.memberships.map((m) => {
        const a = Array.isArray(m.app) ? m.app[0] : m.app;
        return [a?.slug ?? '?', m.role];
      }),
    );
    for (const [slug, role] of Object.entries(WANT)) {
      expect(got.get(slug), `${slug} missing or wrong role (got ${[...got.keys()].join(', ')})`).toBe(role);
    }
  });
});
