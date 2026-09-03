// Plan-driven app activation — Signup v2 (Sjoerd, 2026-09-03: "apps are
// activated... other apps are not visible"). The plan decides which apps a
// workspace runs; nobody assembles their own product from a menu.
//
// Rules:
//  - Meet + Thread come with every plan (Meet is in every tier by decision;
//    Thread is the product).
//  - Flow + Pulse switch on automatically the moment the plan includes them
//    (Pro checkout webhook calls this).
//  - RESPECTS deliberate deactivation: an app the workspace switched OFF
//    stays off — we only create rows that never existed.
//  - Every live user in the workspace gets app_membership (role member) for
//    the activated apps, so nobody stares at a no-access page for an app
//    their plan paid for.

import { adminClient } from '../db.js';
import { planFor } from './plan.js';
import { ensurePipelineFlow } from './pulse-pipeline.js';

const ALWAYS = ['fibre-meet', 'the-thread'];

export async function ensurePlanApps(workspaceId: string): Promise<void> {
  try {
    const plan = await planFor(workspaceId);
    const slugs = [...ALWAYS];
    if (plan.features.flow === true) slugs.push('fibre-flow');
    if (plan.features.pulse === true) slugs.push('fibre-pulse');

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

    const { data: users } = await adminClient
      .from('user')
      .select('id')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    let activatedPulse = false;
    for (const app of apps) {
      if (!known.has(app.id)) {
        const { error } = await adminClient
          .from('workspace_app')
          .insert({ workspace_id: workspaceId, app_id: app.id });
        if (error && error.code !== '23505') {
          console.error('[plan-apps] activate failed', app.slug, error.message);
          continue;
        }
        if (app.slug === 'fibre-pulse') activatedPulse = true;
      }
      // Membership for everyone in the workspace, existing rows untouched.
      for (const u of users ?? []) {
        await adminClient
          .from('app_membership')
          .upsert(
            { user_id: u.id, app_id: app.id, role: 'member' },
            { onConflict: 'user_id,app_id', ignoreDuplicates: true },
          );
      }
    }

    if (activatedPulse && users?.[0]) {
      await ensurePipelineFlow(workspaceId, users[0].id).catch((e) =>
        console.error('[plan-apps] pipeline flow seed failed', e),
      );
    }
  } catch (e) {
    // Fire-and-forget from webhooks and sign-in — never let activation
    // convenience break the flow that called it.
    console.error('[plan-apps] ensurePlanApps failed', workspaceId, e);
  }
}
