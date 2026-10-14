// A tier that is not on the join page, but can still be joined by a link.
//
// Sjoerd, 2026-10-14: "can you set that a tier can also be NOT visible on a
// page?" The case is an invitation — a founding rate, a board tier, a price
// agreed with one organisation — that should not sit in the public list, but
// must still be joinable by the people who were offered it.
//
// THE THREE RULES, and they pull against each other, which is why each gets
// its own case:
//
//   hidden is NOT in the catalogue list       (otherwise it is not hidden)
//   hidden IS served by its own id            (otherwise the link is useless)
//   ARCHIVED is served by neither             (hidden ≠ retired, and a stale
//                                              link must not sell a tier
//                                              that is finished)
//
// Runs against the DEPLOYED staging API. The catalogue is a public, no-auth
// route, so these are plain fetches with no session at all — which is itself
// the right shape for testing what a stranger can reach.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
} from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let ws = '';
let slug = '';
let listedTier = '';
let hiddenTier = '';
let archivedHiddenTier = '';

/** The public catalogue, as a stranger sees it. No Authorization header. */
async function catalog(query = '') {
  const res = await fetch(
    `${API}/api/v1/membership/public/catalog/${encodeURIComponent(slug)}${query}`,
    { headers: { 'X-App-ID': 'membership' } },
  );
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function makeTier(name: string, patch: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from('membership_tier')
    .insert({ workspace_id: ws, name, price_cents_year: 12000, currency: 'EUR', ...patch })
    .select('id')
    .single();
  if (error) throw new Error(`tier ${name}: ${error.message}`);
  return data.id as string;
}

/** The public catalogue answers 404 unless the membership app is switched on
 *  for the workspace (`publicWorkspace` checks `workspace_app`), which a
 *  throwaway workspace has no reason to be. So the fixture does what a
 *  community does when it starts selling memberships. */
async function activateMembership(workspaceId: string) {
  const { data: app, error: appErr } = await service
    .from('app')
    .select('id')
    .eq('slug', 'membership')
    .single();
  if (appErr) throw new Error(`membership app: ${appErr.message}`);
  const { error } = await service
    .from('workspace_app')
    .upsert({ workspace_id: workspaceId, app_id: app.id }, { onConflict: 'workspace_id,app_id' });
  if (error) throw new Error(`workspace_app: ${error.message}`);
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('hiddenTier');
  const { data, error } = await service.from('workspace').select('slug').eq('id', ws).single();
  if (error) throw new Error(`workspace slug: ${error.message}`);
  slug = data.slug as string;
  await activateMembership(ws);

  listedTier = await makeTier('ZZ listed tier', { sort_order: 1 });
  hiddenTier = await makeTier('ZZ hidden tier', { sort_order: 2, hidden: true });
  archivedHiddenTier = await makeTier('ZZ archived hidden tier', {
    sort_order: 3,
    hidden: true,
    archived_at: new Date().toISOString(),
  });
}, 120_000);

afterAll(async () => {
  await service
    .from('membership_tier')
    .delete()
    .in('id', [listedTier, hiddenTier, archivedHiddenTier].filter(Boolean));
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('the public catalogue', () => {
  it('lists the listed tier and NOT the hidden one', async () => {
    const { status, body } = await catalog();
    expect(status).toBe(200);
    const ids = (body.tiers ?? []).map((t: { id: string }) => t.id);
    // Both directions in one case, because "the list is empty" would satisfy
    // the absence assertion on its own and prove nothing.
    expect(ids, 'the listed tier is on the page').toContain(listedTier);
    expect(ids, 'the hidden tier is NOT on the page').not.toContain(hiddenTier);
    expect(ids, 'and neither is an archived one').not.toContain(archivedHiddenTier);
  });

  it('serves the hidden tier by its own id, which is what the link carries', async () => {
    const { status, body } = await catalog(`?tier=${hiddenTier}`);
    expect(status).toBe(200);
    const ids = (body.tiers ?? []).map((t: { id: string }) => t.id);
    expect(ids).toEqual([hiddenTier]);
    // The direct link is for ONE tier. Returning the hidden tier alongside
    // the listed ones would put a private price on a page somebody may then
    // share, which is the opposite of the request.
    expect(ids, 'exactly that tier, not the catalogue plus it').not.toContain(listedTier);
    // And the page needs to be able to SAY it is unlisted, so the flag rides
    // the row (additive, rule 8).
    expect(body.tiers[0].hidden).toBe(true);
  });

  it('still serves a LISTED tier by id, so the link works for any tier', async () => {
    const { body } = await catalog(`?tier=${listedTier}`);
    expect((body.tiers ?? []).map((t: { id: string }) => t.id)).toEqual([listedTier]);
  });

  it('refuses an ARCHIVED tier even by its id', async () => {
    // Hidden means "not advertised". Archived means "finished". A stale
    // invitation must not sell something that has been retired, and this is
    // the one rule the direct link does not get to bypass.
    const { status, body } = await catalog(`?tier=${archivedHiddenTier}`);
    expect(status).toBe(200);
    expect(body.tiers ?? []).toEqual([]);
  });

  it('refuses a tier id from ANOTHER community', async () => {
    // The id is the only authority the link carries, so it must not be
    // portable between communities: pasting it onto a different join page
    // would otherwise sell that community's membership at another's price.
    const other = await createThrowawayWorkspace('hiddenTierOther');
    try {
      // Switched on there as well, deliberately: if that workspace had no
      // membership app, this case would pass on a 404 from the APP check and
      // say nothing about the tenancy filter it exists to test. The tier is
      // asked for through THIS community's slug either way.
      await activateMembership(other);
      const { data } = await service
        .from('membership_tier')
        .insert({ workspace_id: other, name: 'ZZ elsewhere', price_cents_year: 500 })
        .select('id')
        .single();
      const { status, body } = await catalog(`?tier=${data!.id}`);
      expect(status).toBe(200);
      expect(body.tiers ?? [], 'a tier belongs to one community').toEqual([]);
      await service.from('membership_tier').delete().eq('id', data!.id);
    } finally {
      await deleteThrowawayWorkspace(other);
    }
  });

  it('answers 404 for a malformed tier id rather than a database error', async () => {
    // PostgREST answers 400 for an unparseable uuid, which would turn a
    // mistyped link into an error page instead of "no such thing".
    const { status } = await catalog('?tier=not-a-uuid');
    expect(status).toBe(404);
  });
});
