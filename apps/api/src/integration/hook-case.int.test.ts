// Regression for the hook email-case landmine (migration 20260907190000):
// a public."user" row whose email casing differs from the auth record must
// STILL get its claims stamped. Before the lower() hardening this minted a
// token with no workspace_id/app_user_id at all — a silent, claim-less
// sign-in. The fixture reproduces the exact trigger: lowercase auth email,
// mixed-case public.user email.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  anonKey,
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
  url,
} from './staging.js';

let ws: string;
let authUserId: string;
let userRowId: string;
let accessToken: string;

beforeAll(async () => {
  ws = await createThrowawayWorkspace('hookcase');
  const lower = `int-hookcase-${randomUUID().slice(0, 8)}@example.com`;
  const mixed = lower.replace('int-hookcase', 'INT-HookCase');

  const { data: created, error: cErr } = await service.auth.admin.createUser({
    email: lower,
    email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(`createUser: ${cErr?.message}`);
  authUserId = created.user.id;

  // The landmine: the platform row carries different CASING than auth.
  const { data: row, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: ws, email: mixed })
    .select('id')
    .single();
  if (uErr) throw new Error(`user row: ${uErr.message}`);
  userRowId = row.id as string;

  const { data: link, error: lErr } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: lower,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (lErr || !tokenHash) throw new Error(`generateLink: ${lErr?.message}`);

  const scratch = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let v = await scratch.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (v.error) v = await scratch.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  if (v.error || !v.data.session) throw new Error(`verifyOtp: ${v.error?.message}`);
  accessToken = v.data.session.access_token;
}, 60_000);

afterAll(async () => {
  if (userRowId) await service.from('user').delete().eq('id', userRowId);
  if (authUserId) await service.auth.admin.deleteUser(authUserId).catch(() => undefined);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 60_000);

describe('access-token hook vs email casing', () => {
  it('claims are stamped even when public.user carries mixed-case email', () => {
    const claims = JSON.parse(
      Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString() || '{}',
    );
    expect(claims.workspace_id, JSON.stringify(claims)).toBe(ws);
    expect(claims.app_user_id).toBe(userRowId);
  });
});
