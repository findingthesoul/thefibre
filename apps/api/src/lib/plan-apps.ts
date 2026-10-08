// Plan-driven app activation — Signup v2 (Sjoerd, 2026-09-03: "apps are
// activated... other apps are not visible"). The plan decides which apps a
// workspace runs; nobody assembles their own product from a menu.
//
// Rules:
//  - Meet + Thread come with every plan (Meet is in every tier by decision;
//    Thread is the product).
//  - Flow + Pulse deliberately do NOT auto-activate (Sjoerd, 2026-09-03:
//    "Pulse can stay out of the loop for now, as does flow"). Pro makes them
//    AVAILABLE in Settings → Apps; switching them on stays a human act —
//    they are backstage tools, not part of the welcome parade.
//  - RESPECTS deliberate deactivation: an app the workspace switched OFF
//    stays off — we only create rows that never existed.
//  - The activated apps go to the workspace's EVERYONE team, once, at
//    activation, so every MEMBER holds them and nobody stares at a no-access
//    page for an app their plan paid for. Granted once and never
//    re-asserted, because an admin who removes one has to be able to make it
//    stay removed (Sjoerd, 2026-10-08: "meet thread via everyone").

import { adminClient } from '../db.js';
import { ensureAutomaticTeams } from './automatic-teams.js';
import { syncTeam } from './team-grants.js';

const ALWAYS = ['fibre-meet', 'the-thread'];

export async function ensurePlanApps(workspaceId: string): Promise<void> {
  try {
    const slugs = [...ALWAYS];

    const { data: apps } = await adminClient
      .from('app')
      .select('id, slug')
      .in('slug', slugs)
      .eq('status', 'approved')
      .not('released_at', 'is', null);
    if (!apps?.length) return;

    const { data: existing } = await adminClient
      .from('workspace_app')
      .select('app_id')
      .eq('workspace_id', workspaceId);
    const known = new Set((existing ?? []).map((r) => r.app_id));

    // The baseline is a TEAM GRANT now, not a per-user write.
    //
    // Sjoerd, 2026-10-08: *"meet thread via everyone"*. Until today this
    // upserted an app_membership row for every user in the workspace, on
    // every sign-in — and that is exactly what made "remove Thread from
    // Everyone" do nothing: the rows came straight back on the next sign-in,
    // so the control an admin was given could not work. The grant is made
    // ONCE, when the app is first activated here, and nothing re-asserts it.
    //
    // Two consequences, both deliberate, both changes:
    //
    //   MEMBERS, not every `user` row. The old grid granted to every live
    //   user in the workspace, which includes PARTICIPANTS — people who
    //   booked or enrolled and hold no seat. They were being given
    //   app_membership for Meet and Thread. Everyone's roster is
    //   workspace_member, so they are not granted any more. Nothing is taken
    //   from those who already hold a row: that is the conversion script's
    //   job, and it leaves non-members alone on purpose.
    //
    //   An app ALREADY activated here gets nothing, not even a repair. If its
    //   grant was removed on purpose, re-adding it would be the very bug this
    //   change exists to fix. `scripts/grant-plan-apps-to-everyone.ts` is the
    //   deliberate way to put one back.
    for (const app of apps) {
      if (known.has(app.id)) continue;
      const { error } = await adminClient
        .from('workspace_app')
        .insert({ workspace_id: workspaceId, app_id: app.id });
      if (error && error.code !== '23505') {
        console.error('[plan-apps] activate failed', app.slug, error.message);
        continue;
      }
      const { everyone } = await ensureAutomaticTeams(workspaceId);
      if (!everyone) continue;
      const { error: gErr } = await adminClient
        .from('team_app_grant')
        .upsert(
          { team_id: everyone, app_id: app.id, lead_is_app_admin: false },
          { onConflict: 'team_id,app_id' },
        );
      if (gErr) {
        console.error('[plan-apps] granting to Everyone failed', app.slug, gErr.message);
        continue;
      }
      await syncTeam(everyone);
    }

  } catch (e) {
    // Fire-and-forget from webhooks and sign-in — never let activation
    // convenience break the flow that called it.
    console.error('[plan-apps] ensurePlanApps failed', workspaceId, e);
  }
}
