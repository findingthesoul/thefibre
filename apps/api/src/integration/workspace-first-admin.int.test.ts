// A workspace is created with somebody in it, or it is not created.
//
// Before 2026-09-26 `POST /workspaces` made the workspace row and stopped.
// Membership is a public."user" row — the JWT's workspace_id is read from it
// — so a workspace with no user has no door: not for its owner, not for a
// super admin, who gets the admin SCREENS but never a user row. And the only
// member-adding endpoint acts on the caller's own workspace. The room sealed
// itself and looked healthy in the list.
//
// These run against real Postgres because every claim here is about rows the
// route writes in other tables, and the failure mode was precisely that it
// wrote none of them.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { service } from './staging.js';
import { seedFirstAdmin } from '../lib/first-admin.js';

const made: string[] = [];
let wsId: string;
let userId: string;
const email = `first-admin-${Date.now()}@example.test`;

beforeAll(async () => {
  const { data, error } = await service
    .from('workspace')
    .insert({ slug: `first-admin-${Date.now()}`, name: 'First admin fixture' })
    .select('id')
    .single();
  if (error) throw new Error(`fixture workspace: ${error.message}`);
  wsId = data!.id as string;
  made.push(wsId);

  const seeded = await seedFirstAdmin({ workspaceId: wsId, email, name: 'Ada Probe', sendInvite: false });
  userId = seeded.userId;
});

afterAll(async () => {
  if (userId) {
    await service.from('app_membership').delete().eq('user_id', userId);
    await service.from('workspace_member').delete().eq('user_id', userId);
  }
  for (const id of made) {
    await service.from('person').delete().eq('workspace_id', id);
    await service.from('user').delete().eq('workspace_id', id);
    await service.from('workspace').delete().eq('id', id);
  }
});

describe('seedFirstAdmin', () => {
  it('creates the user row the JWT reads its workspace from', async () => {
    // Without THIS row, nothing else matters: the access-token hook resolves
    // workspace_id by joining auth.users to public."user" on email, so no row
    // means no claim means no workspace, whoever you are.
    const { data } = await service
      .from('user')
      .select('id, email, workspace_id, deleted_at')
      .eq('workspace_id', wsId);
    expect(data).toHaveLength(1);
    expect(data![0].email).toBe(email);
    expect(data![0].deleted_at).toBeNull();
  });

  it('pairs them with a person, because every user has one', async () => {
    const { data: u } = await service.from('user').select('person_id').eq('id', userId).single();
    expect(u!.person_id).toBeTruthy();
    const { data: p } = await service
      .from('person')
      .select('id, user_id')
      .eq('id', u!.person_id as string)
      .single();
    expect(p!.user_id).toBe(userId); // linked BOTH ways
  });

  it('makes them super_admin — they are alone, so they must be able to invite the next one', async () => {
    const { data } = await service
      .from('workspace_member')
      .select('workspace_role, relationship_type')
      .eq('user_id', userId)
      .eq('workspace_id', wsId)
      .single();
    expect(data!.workspace_role).toBe('super_admin');
    expect(data!.relationship_type).toBe('internal');
  });

  it('grants fibre-platform admin, which is what Settings → Members checks', async () => {
    // The page reads memberships for slug 'fibre-platform' with role 'admin'
    // and redirects anybody else away. grantableSlugs() excludes that slug
    // from ordinary invites, so if this is not granted here it is granted
    // nowhere, and the first admin cannot reach the page they exist for.
    const { data: app } = await service.from('app').select('id').eq('slug', 'fibre-platform').single();
    const { data } = await service
      .from('app_membership')
      .select('role')
      .eq('user_id', userId)
      .eq('app_id', app!.id as string)
      .single();
    expect(data!.role).toBe('admin');
  });

  it('refuses a second first-admin on the same address rather than making a duplicate', async () => {
    // unique (workspace_id, email). The route deletes the workspace when this
    // throws, which is the behaviour that keeps an empty one from surviving.
    await expect(
      seedFirstAdmin({ workspaceId: wsId, email, name: null, sendInvite: false }),
    ).rejects.toThrow();
  });
});
