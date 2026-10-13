// Slice 3: who appears in the member list, and who sees them.
//
// This is the first surface where one member can see another, so the
// assertions that matter are the ones about people who must NOT appear. A
// list test that only checks the happy path passes just as well when the
// filter is missing.
//
// Runs against the DEPLOYED staging API with a real participant session,
// because every rule here lives in the route on the service role, where RLS
// cannot see it.
//
// The sharpest cases:
//   - a member who never touched the switch is ABSENT (no row = not listed),
//     which is the rule the spec had backwards until 2026-10-05;
//   - the whole list is 404 when the community has not switched it on, and
//     404 is not an empty list: "no directory here" and "nobody here yet"
//     are different answers;
//   - in category mode, a member sharing no category is absent even though
//     they are listed and active;
//   - contact fields are null unless that member chose to show them.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let ws = '';
let viewer: FixtureUser;
let viewerPerson = '';
let tierShared = '';
let tierOther = '';
let catShared = '';
let catOther = '';
const made: { persons: string[]; members: string[]; products: string[] } = {
  persons: [],
  members: [],
  products: [],
};

async function call(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${viewer.accessToken}`, 'X-App-ID': 'membership' },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function setSettings(patch: Record<string, unknown>) {
  const { error } = await service
    .from('membership_settings')
    .upsert({ workspace_id: ws, ...patch }, { onConflict: 'workspace_id' });
  if (error) throw new Error(`settings: ${error.message}`);
}

/** A member of this workspace: person, membership on `tier`, and an entry
 *  unless `listed` is null (which means "never touched the switch"). */
async function makeMember(
  name: string,
  tier: string,
  listed: boolean | null,
  showContact: boolean | null = null,
  status = 'active',
) {
  const { data: p, error: pErr } = await service
    .from('person')
    .insert({
      workspace_id: ws,
      first_name: name,
      last_name: 'Listed',
      email: `int-dir-${name.toLowerCase()}-${Date.now()}@example.com`,
      city: 'Rotterdam',
      country: 'NL',
    })
    .select('id')
    .single();
  if (pErr) throw new Error(`person ${name}: ${pErr.message}`);
  const personId = p.id as string;
  made.persons.push(personId);

  const { data: m, error: mErr } = await service
    .from('membership_member')
    .insert({ workspace_id: ws, person_id: personId, tier_id: tier, status })
    .select('id')
    .single();
  if (mErr) throw new Error(`member ${name}: ${mErr.message}`);
  made.members.push(m.id as string);

  if (listed !== null) {
    const { error } = await service
      .from('membership_directory_entry')
      .insert({ workspace_id: ws, person_id: personId, listed, show_contact: showContact });
    if (error) throw new Error(`entry ${name}: ${error.message}`);
  }
  return personId;
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('dirList');
  viewer = await createFixtureUser(ws, 'dir-view');

  const mkCat = async (name: string) => {
    const { data, error } = await service
      .from('membership_directory_category')
      .insert({ workspace_id: ws, name })
      .select('id')
      .single();
    if (error) throw new Error(`category: ${error.message}`);
    return data.id as string;
  };
  catShared = await mkCat('int-shared');
  catOther = await mkCat('int-other');

  const mkTierWithCategory = async (tierName: string, categoryId: string) => {
    const { data: t, error: tErr } = await service
      .from('membership_tier')
      .insert({ workspace_id: ws, name: tierName })
      .select('id')
      .single();
    if (tErr) throw new Error(`tier: ${tErr.message}`);
    const { data: pr, error: prErr } = await service
      .from('membership_product')
      .insert({ workspace_id: ws, name: `${tierName} product` })
      .select('id')
      .single();
    if (prErr) throw new Error(`product: ${prErr.message}`);
    made.products.push(pr.id as string);
    await service
      .from('membership_tier_product')
      .insert({ tier_id: t.id as string, product_id: pr.id as string });
    await service
      .from('membership_product_category')
      .insert({ product_id: pr.id as string, category_id: categoryId });
    return t.id as string;
  };
  tierShared = await mkTierWithCategory('int-shared-tier', catShared);
  tierOther = await mkTierWithCategory('int-other-tier', catOther);

  // The viewer: a person carrying their own address, listed, on the shared tier.
  const { data: vp, error: vpErr } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: 'Viewer', last_name: 'Self', email: viewer.email })
    .select('id')
    .single();
  if (vpErr) throw new Error(`viewer person: ${vpErr.message}`);
  viewerPerson = vp.id as string;
  made.persons.push(viewerPerson);
  const { data: vm } = await service
    .from('membership_member')
    .insert({ workspace_id: ws, person_id: viewerPerson, tier_id: tierShared, status: 'active' })
    .select('id')
    .single();
  made.members.push(vm!.id as string);
  await service
    .from('membership_directory_entry')
    .insert({ workspace_id: ws, person_id: viewerPerson, listed: true });

  await setSettings({ directory_enabled: true, directory_visibility: 'everybody' });
}, 120_000);

afterAll(async () => {
  for (const id of made.persons) {
    await service.from('membership_directory_entry').delete().eq('person_id', id);
    await service.from('consent_record').delete().eq('person_id', id);
  }
  for (const id of made.members) await service.from('membership_member').delete().eq('id', id);
  for (const id of made.products) {
    await service.from('membership_product_category').delete().eq('product_id', id);
    await service.from('membership_tier_product').delete().eq('product_id', id);
    await service.from('membership_product').delete().eq('id', id);
  }
  for (const id of made.persons) await service.from('person').delete().eq('id', id);
  await service.from('membership_tier').delete().in('id', [tierShared, tierOther].filter(Boolean));
  await service
    .from('membership_directory_category')
    .delete()
    .in('id', [catShared, catOther].filter(Boolean));
  if (viewer) await deleteFixtureUser(viewer);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('whether the list exists at all', () => {
  it('is 404 when the community has not switched it on — not an empty list', async () => {
    await setSettings({ directory_enabled: false });
    const { status } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(status, '"no directory here" must not look like "nobody here yet"').toBe(404);
    await setSettings({ directory_enabled: true });
  });

  it('refuses a community that does not know you', async () => {
    const other = await createThrowawayWorkspace('dirNope');
    const { status } = await call(`/api/v1/membership/portal/me/directory/${other}/members`);
    expect(status).toBe(403);
    await deleteThrowawayWorkspace(other);
  });
});

describe('who appears', () => {
  let optedIn = '';
  let neverTouched = '';
  let optedOut = '';
  let lapsed = '';

  beforeAll(async () => {
    optedIn = await makeMember('Opted', tierShared, true);
    neverTouched = await makeMember('Untouched', tierShared, null);
    optedOut = await makeMember('Declined', tierShared, false);
    lapsed = await makeMember('Lapsed', tierShared, true, null, 'lapsed');
  }, 60_000);

  it('shows a member who opted in', async () => {
    const { status, body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.you_are_listed).toBe(true);
    const ids = body.items.map((i: any) => i.person_id);
    expect(ids, 'the member who opted in should be there').toContain(optedIn);
  });

  it('does NOT show a member who never touched the switch', async () => {
    const { body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    const ids = body.items.map((i: any) => i.person_id);
    // The rule the spec had backwards: no row means NOT listed.
    expect(ids, 'a missing entry must mean not listed').not.toContain(neverTouched);
  });

  it('DOES show a member in grace — a late payment is not leaving', async () => {
    const inGrace = await makeMember('Grace', tierShared, true, null, 'grace');
    const { body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(
      body.items.map((i: any) => i.person_id),
      'grace counts (Sjoerd, 2026-10-05)',
    ).toContain(inGrace);
  }, 60_000);

  it('does NOT show a member who opted out, or one whose membership lapsed', async () => {
    const { body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    const ids = body.items.map((i: any) => i.person_id);
    expect(ids).not.toContain(optedOut);
    expect(ids, 'only an ACTIVE membership is a candidate').not.toContain(lapsed);
  });

  it('does not put the viewer in their own list', async () => {
    const { body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    const ids = body.items.map((i: any) => i.person_id);
    expect(ids).not.toContain(viewerPerson);
  });
});

describe('category mode', () => {
  it('hides a listed, active member who shares no category', async () => {
    const sharing = await makeMember('Sharer', tierShared, true);
    const apart = await makeMember('Apart', tierOther, true);

    await setSettings({ directory_visibility: 'category' });
    const { body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    const ids = body.items.map((i: any) => i.person_id);
    expect(ids, 'same category as the viewer').toContain(sharing);
    expect(ids, 'listed and active, but no category in common').not.toContain(apart);

    await setSettings({ directory_visibility: 'everybody' });
    const { body: all } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(
      all.items.map((i: any) => i.person_id),
      'the same member appears once the mode is everybody',
    ).toContain(apart);
  }, 60_000);
});

describe('contact details', () => {
  it('are null unless that member chose to show them', async () => {
    const shown = await makeMember('Shown', tierShared, true, true);
    const hidden = await makeMember('Hidden', tierShared, true, false);
    const { body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    const find = (id: string) => body.items.find((i: any) => i.person_id === id);
    expect(find(shown)?.email, 'chose to show').toBeTruthy();
    expect(find(hidden)?.email, 'chose to hide').toBeNull();
    expect(find(hidden)?.phone).toBeNull();
    // Never returned by this surface, whatever the choice (§5).
    expect(find(shown)).not.toHaveProperty('region');
    expect(find(shown)).not.toHaveProperty('street');
    expect(find(shown)).not.toHaveProperty('postal_code');
  }, 60_000);
});

// ──────────────────────────────────────────────────────────────────────────
// WHO MAY READ IT — Sjoerd, 2026-10-14, re-reported with screenshots.
//
// Consent controls whether you APPEAR. Membership controls whether you may
// LOOK. Until this date the viewer had to be listed themselves, so the switch
// bought access; and because the membership check behind it filtered only on
// `deleted_at`, a LAPSED member who still had an old entry could read the
// whole list. The change closes that at the same time as it opens the other.
//
// Every case here moves the VIEWER's own row and puts it back, so the tests
// above keep the viewer they were written against.
// ──────────────────────────────────────────────────────────────────────────
describe('who may read the list', () => {
  const setViewerStatus = async (status: string) => {
    const { error } = await service
      .from('membership_member')
      .update({ status })
      .eq('workspace_id', ws)
      .eq('person_id', viewerPerson);
    if (error) throw new Error(`viewer status: ${error.message}`);
  };
  const setViewerListed = async (listed: boolean) => {
    const { error } = await service
      .from('membership_directory_entry')
      .update({ listed })
      .eq('workspace_id', ws)
      .eq('person_id', viewerPerson);
    if (error) throw new Error(`viewer listed: ${error.message}`);
  };

  afterEach(async () => {
    await setViewerStatus('active');
    await setViewerListed(true);
  });

  it('shows the list to an active member who is NOT shown in it', async () => {
    await setViewerListed(false);
    const { status, body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(status).toBe(200);
    expect(body.can_view, 'an active member may read the list whether or not they appear').toBe(
      true,
    );
    expect(body.you_are_listed, 'and must still be told they do not appear').toBe(false);
    // NOT just can_view: the items are the point. An endpoint that returned
    // can_view true and an empty array would pass a weaker assertion while
    // showing the member nothing — which is the bug being fixed.
    expect(body.items.length, 'and they see the people who did opt in').toBeGreaterThan(0);
  });

  it('refuses a LAPSED member who is still listed — the hole this closes', async () => {
    await setViewerStatus('lapsed');
    await setViewerListed(true);
    const { status, body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(status, 'a lapsed membership is not a key to the member list').toBe(403);
    expect(body?.items, 'and no rows leak alongside the refusal').toBeUndefined();
  });

  it('refuses a CANCELLED member', async () => {
    await setViewerStatus('cancelled');
    const { status } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(status).toBe(403);
  });

  it('lets a member in GRACE read it — a late payment is not leaving', async () => {
    await setViewerStatus('grace');
    const { status, body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(status).toBe(200);
    expect(body.can_view).toBe(true);
  });

  it('tells a listed member that they are listed', async () => {
    const { status, body } = await call(`/api/v1/membership/portal/me/directory/${ws}/members`);
    expect(status).toBe(200);
    expect(body.you_are_listed).toBe(true);
    expect(body.can_view).toBe(true);
  });
});
