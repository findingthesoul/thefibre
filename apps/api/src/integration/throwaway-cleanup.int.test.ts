// The cleanup removes a workspace that holds every child the suites create.
//
// 79 int-test workspaces had accumulated on staging by 2026-10-12, and the
// reason was one quiet line: `deleteThrowawayWorkspace` removed persons and
// leaned on cascades, several tables reference a person or a workspace with
// no cascade, and the failure surfaced as a console warning in a run that
// otherwise passed. It is not cosmetic either — team slugs live in the GLOBAL
// `public_root_slug` table, so a leaked workspace keeps them and the next run
// of the file that made it cannot seed at all.
//
// So this seeds the whole zoo in one throwaway workspace, asks the helper to
// remove it, and asserts the row is actually gone. It is the test the helper
// never had: everything else in the suite uses it as a teardown, where a
// failure is a warning nobody reads.

import { afterAll, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

// Module scope so the safety net below can reach it. A test whose teardown
// lives in its own body skips the teardown exactly when it is needed — which
// is how the first run of THIS file leaked, while testing leaks.
let ws = '';

afterAll(async () => {
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('deleteThrowawayWorkspace', () => {
  it('removes a workspace holding every child the int suites create', async () => {
    ws = await createThrowawayWorkspace('cleanup');
    // A slug unique to THIS run. Team slugs are globally unique
    // (public_root_slug), so a run that leaks would otherwise make every
    // later run fail at SEEDING rather than at the thing under test — which
    // is precisely the failure this file exists to prevent, and it happened
    // here first.
    const uniq = `cleanup-${ws.slice(0, 8)}`;

    const ins = async (table: string, row: Record<string, unknown>) => {
      const { data, error } = await service.from(table).insert(row).select('id').single();
      if (error) throw new Error(`fixture ${table}: ${error.message}`);
      return data!.id as string;
    };

    // A person and a user, pointed at each other — the pair the helper has
    // always had to unlink before either can go.
    const personId = await ins('person', {
      workspace_id: ws,
      first_name: 'Cleanup',
      last_name: 'Fixture',
      email: 'cleanup-fixture@example.com',
    });
    const userId = await ins('user', { workspace_id: ws, email: 'cleanup-fixture@example.com' });
    await service.from('user').update({ person_id: personId }).eq('id', userId);

    // A team: the row whose slug is globally unique, so a leak blocks the
    // next seed rather than merely littering.
    const teamId = await ins('team', {
      workspace_id: ws,
      name: 'Cleanup team',
      slug: `${uniq}-team`,
      is_active: true,
    });

    // An organiser, a programme and a thread.
    const organiserId = await ins('thread_organiser', {
      user_id: userId,
      workspace_id: ws,
      slug: `${uniq}-organiser`,
    });
    const appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!
      .id;
    const programId = await ins('program', {
      workspace_id: ws,
      app_id: appId,
      title: 'Cleanup programme',
      format: 'journey',
      status: 'active',
    });
    await ins('thread_thread', {
      workspace_id: ws,
      program_id: programId,
      organiser_id: organiserId,
      slug: `${uniq}-thread`,
      team_id: teamId,
      price_cents: 1000,
    });

    // The membership zoo — a member row referencing the person is what
    // actually pinned the workspace that started all this.
    const tierId = await ins('membership_tier', { workspace_id: ws, name: 'Cleanup tier' });
    const productId = await ins('membership_product', {
      workspace_id: ws,
      name: 'Cleanup product',
    });
    await service
      .from('membership_tier_product')
      .insert({ tier_id: tierId, product_id: productId, optional: false });
    await ins('membership_access_grant', {
      workspace_id: ws,
      tier_id: tierId,
      kind: 'team_calendar',
      config: { team_id: teamId, discount_pct: 100 },
    });
    await ins('membership_access_grant', {
      workspace_id: ws,
      product_id: productId,
      kind: 'circle',
      config: { space_id: 'cleanup' },
    });
    const memberId = await ins('membership_member', {
      workspace_id: ws,
      person_id: personId,
      tier_id: tierId,
      status: 'active',
    });
    // The two that reference a PERSON or a member without going through the
    // workspace. Seeded on purpose: a cleanup line whose row never exists in
    // the test is a line the test cannot say anything about, and this file is
    // the only place that measures which of them are load-bearing.
    await ins('membership_product_purchase', {
      workspace_id: ws,
      person_id: personId,
      product_id: productId,
      amount_cents: 1000,
      currency: 'EUR',
      status: 'paid',
      // NOT NULL on this table — asked of the database after it refused the
      // insert, rather than guessed a second time.
      stripe_session_id: 'cs_test_cleanup_fixture',
    });
    const { data: grantRow } = await service
      .from('membership_access_grant')
      .select('id')
      .eq('workspace_id', ws)
      .limit(1)
      .single();
    await ins('membership_member_access', {
      member_id: memberId,
      access_grant_id: grantRow!.id,
      status: 'granted',
    });

    const gone = await deleteThrowawayWorkspace(ws);
    expect(gone, 'the helper reports the workspace removed').toBe(true);

    // And the row really is absent — the helper's own answer is what this
    // test exists to doubt.
    const { data: still } = await service.from('workspace').select('id').eq('id', ws).maybeSingle();
    expect(still, 'the workspace row is gone from the database').toBeNull();

    // The slug is free again, which is the consequence that actually bites:
    // the next run of a file that makes a team with this slug must be able to.
    const { data: slugRows } = await service.from('team').select('id').eq('slug', `${uniq}-team`);
    expect(slugRows ?? [], 'the team is gone, so its global slug is free').toHaveLength(0);
  }, 180_000);
});
