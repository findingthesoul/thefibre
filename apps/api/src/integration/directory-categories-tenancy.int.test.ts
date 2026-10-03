// Member directory slice 1: the tenancy floor on the two new tables.
//
// The point of this file is NOT that a stranger is refused — with
// `has_app_membership('membership')` in every policy, a fixture user who was
// never given that membership is refused everything, and a suite built only
// of denials would be green on a table with no policies at all. That is the
// §11.3d failure: a check that passes for the wrong reason.
//
// So every denial here is paired with a POSITIVE CONTROL in the same
// describe: A does the thing successfully, then B is refused the same thing.
// If the policies were dropped tomorrow, the positives would still pass and
// the negatives would fail — which is the only arrangement that tells us
// anything.
//
// The sharpest case is the last one: A is a legitimate admin of A, holding a
// real product of A, trying to link it to a category of B. Both halves of
// the insert policy have to hold, and only the database can enforce that —
// which is why `membership_product_category` carries no workspace_id of its
// own (two places able to disagree, and a CHECK cannot reach another table).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  jwtClaims,
  service,
  type FixtureUser,
} from './staging.js';

let wsA: string, wsB: string;
let userA: FixtureUser, userB: FixtureUser;
let catA: string, catB: string;
let productA: string;
let membershipAppId: string;

/** Everything the policies ask of a membership admin: the app switched on
 *  for the workspace, a direct app_membership with the admin role, and the
 *  workspace_member row that is_workspace_admin() reads. */
async function makeMembershipAdmin(ws: string, u: FixtureUser) {
  const { error: waErr } = await service
    .from('workspace_app')
    .upsert({ workspace_id: ws, app_id: membershipAppId }, { onConflict: 'workspace_id,app_id' });
  if (waErr) throw new Error(`workspace_app: ${waErr.message}`);
  const { error: amErr } = await service
    .from('app_membership')
    .upsert(
      { user_id: u.userId, app_id: membershipAppId, role: 'admin', is_direct: true },
      { onConflict: 'user_id,app_id' },
    );
  if (amErr) throw new Error(`app_membership: ${amErr.message}`);
  const { error: wmErr } = await service
    .from('workspace_member')
    .upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);
}

beforeAll(async () => {
  wsA = await createThrowawayWorkspace('dirA');
  wsB = await createThrowawayWorkspace('dirB');
  [userA, userB] = await Promise.all([
    createFixtureUser(wsA, 'dir-a'),
    createFixtureUser(wsB, 'dir-b'),
  ]);

  const { data: app, error: appErr } = await service
    .from('app')
    .select('id')
    .eq('slug', 'membership')
    .single();
  if (appErr || !app) throw new Error(`no membership app row: ${appErr?.message}`);
  membershipAppId = app.id as string;

  await makeMembershipAdmin(wsA, userA);
  await makeMembershipAdmin(wsB, userB);

  // Seeded with the service role so the reads below are testing the READ
  // policy and not whatever the insert policy happened to allow.
  const mkCategory = async (ws: string, name: string) => {
    const { data, error } = await service
      .from('membership_directory_category')
      .insert({ workspace_id: ws, name })
      .select('id')
      .single();
    if (error) throw new Error(`category ${name}: ${error.message}`);
    return data.id as string;
  };
  catA = await mkCategory(wsA, 'int-test fellows A');
  catB = await mkCategory(wsB, 'int-test fellows B');

  const { data: prod, error: prodErr } = await service
    .from('membership_product')
    .insert({ workspace_id: wsA, name: 'int-test product A' })
    .select('id')
    .single();
  if (prodErr) throw new Error(`product: ${prodErr.message}`);
  productA = prod.id as string;
}, 90_000);

afterAll(async () => {
  if (productA) await service.from('membership_product_category').delete().eq('product_id', productA);
  if (productA) await service.from('membership_product').delete().eq('id', productA);
  await service
    .from('membership_directory_category')
    .delete()
    .in('id', [catA, catB].filter(Boolean));
  for (const u of [userA, userB]) {
    if (!u) continue;
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (wsA) await deleteThrowawayWorkspace(wsA);
  if (wsB) await deleteThrowawayWorkspace(wsB);
}, 90_000);

describe('the fixtures are what the test assumes', () => {
  it('each admin session names its own workspace', () => {
    expect(jwtClaims(userA).workspace_id, JSON.stringify(jwtClaims(userA))).toBe(wsA);
    expect(jwtClaims(userB).workspace_id, JSON.stringify(jwtClaims(userB))).toBe(wsB);
  });
});

describe('reading categories', () => {
  it('A sees its own category — the positive control for every denial below', async () => {
    const { data, error } = await userA.client
      .from('membership_directory_category')
      .select('id')
      .in('id', [catA, catB]);
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id)).toEqual([catA]);
  });

  it("B does not see A's category", async () => {
    const { data, error } = await userB.client
      .from('membership_directory_category')
      .select('id')
      .eq('id', catA);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});

describe('writing categories', () => {
  it('A can create a category in its own workspace (positive control)', async () => {
    const { data, error } = await userA.client
      .from('membership_directory_category')
      .insert({ workspace_id: wsA, name: 'int-test created by A' })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data?.id) await service.from('membership_directory_category').delete().eq('id', data.id);
  });

  it("B cannot create a category in A's workspace", async () => {
    const { data, error } = await userB.client
      .from('membership_directory_category')
      .insert({ workspace_id: wsA, name: 'int-test smuggled' })
      .select('id');
    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
    const { data: check } = await service
      .from('membership_directory_category')
      .select('id')
      .eq('workspace_id', wsA)
      .eq('name', 'int-test smuggled');
    expect(check ?? []).toEqual([]);
  });

  it("B cannot rename A's category (0 rows, value unchanged)", async () => {
    const { data } = await userB.client
      .from('membership_directory_category')
      .update({ name: 'HIJACKED' })
      .eq('id', catA)
      .select('id');
    expect(data ?? []).toEqual([]);
    const { data: check } = await service
      .from('membership_directory_category')
      .select('name')
      .eq('id', catA)
      .single();
    expect(check!.name).toBe('int-test fellows A');
  });

  it("B cannot delete A's category", async () => {
    const { data } = await userB.client
      .from('membership_directory_category')
      .delete()
      .eq('id', catA)
      .select('id');
    expect(data ?? []).toEqual([]);
    const { data: still } = await service
      .from('membership_directory_category')
      .select('id')
      .eq('id', catA);
    expect(still).toHaveLength(1);
  });
});

describe('linking a product to a category', () => {
  it("A can link its own product to its own category (positive control)", async () => {
    const { data, error } = await userA.client
      .from('membership_product_category')
      .insert({ product_id: productA, category_id: catA })
      .select('product_id');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("B cannot read A's product links", async () => {
    const { data, error } = await userB.client
      .from('membership_product_category')
      .select('product_id')
      .eq('product_id', productA);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  // The one that matters: a legitimate admin, their own product, somebody
  // else's category id. Only the second EXISTS in the insert policy stops
  // this, and nothing in the API layer is asked to.
  it("A cannot link its own product to B's category", async () => {
    const { data, error } = await userA.client
      .from('membership_product_category')
      .insert({ product_id: productA, category_id: catB })
      .select('product_id');
    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
    const { data: check } = await service
      .from('membership_product_category')
      .select('product_id')
      .eq('product_id', productA)
      .eq('category_id', catB);
    expect(check ?? []).toEqual([]);
  });

  it("B cannot delete A's product link", async () => {
    const { data } = await userB.client
      .from('membership_product_category')
      .delete()
      .eq('product_id', productA)
      .select('product_id');
    expect(data ?? []).toEqual([]);
    const { data: still } = await service
      .from('membership_product_category')
      .select('product_id')
      .eq('product_id', productA);
    expect(still).toHaveLength(1);
  });
});
