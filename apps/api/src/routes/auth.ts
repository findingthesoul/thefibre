import { Hono } from 'hono';
import { can } from '../lib/plan.js';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';
import { profileFor } from '../lib/identity-profile.js';

export const authRoutes = new Hono();

// ---------------------------------------------------------------------------
// The workspaces this person belongs to, and which one they are acting in.
//
// A person is one email. Inside each workspace they have their own
// `public."user"` row — which is what `unique (workspace_id, email)` has always
// allowed. These two routes are the only way to see and change which of those
// rows a session acts as.
//
// adminClient, not userClient: RLS answers "what can I see IN my workspace",
// and the whole point here is to look ACROSS them. The gate is the email match
// below — a person can only ever see rows carrying their own address.
// ---------------------------------------------------------------------------

/** Every live user row sharing this session's email. */
async function myMemberships(ctx: { userId: string }) {
  const { data: me } = await adminClient
    .from('user')
    .select('email')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (!me?.email) return [];

  const { data } = await adminClient
    .from('user')
    .select('id, workspace_id, created_at, workspace:workspace_id (id, name, slug, plan)')
    .eq('email', me.email)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  return data ?? [];
}

// Which of someone's workspaces the calling app works in.
//
// Two conditions, the same pair every app layout checks on the way in: the
// workspace has the app switched on, and this person's seat THERE has a grant
// for it. A seat is per workspace, so the grant has to be looked up per seat
// — the same human can hold The Thread in one workspace and not in another.
//
// Returns null for The Fibre itself, meaning "all of them". The platform is
// not an app a workspace activates — it is the place the account lives — so
// its switcher lists every seat, and its own app_membership row is about
// admin rights, not entry.
async function usableWorkspaces(
  appSlug: string | undefined,
  rows: { id: string; workspace_id: string }[],
): Promise<Set<string> | null> {
  if (!appSlug || appSlug === 'fibre-platform') return null;
  if (!rows.length) return new Set();

  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', appSlug)
    .maybeSingle();
  if (!app) return new Set();

  const [{ data: grants }, { data: active }] = await Promise.all([
    adminClient
      .from('app_membership')
      .select('user_id')
      .eq('app_id', app.id)
      .in('user_id', rows.map((r) => r.id)),
    adminClient
      .from('workspace_app')
      .select('workspace_id')
      .eq('app_id', app.id)
      .is('deactivated_at', null)
      .in('workspace_id', rows.map((r) => r.workspace_id)),
  ]);

  const granted = new Set((grants ?? []).map((g) => g.user_id));
  const switchedOn = new Set((active ?? []).map((a) => a.workspace_id));
  return new Set(
    rows
      .filter((r) => granted.has(r.id) && switchedOn.has(r.workspace_id))
      .map((r) => r.workspace_id),
  );
}

authRoutes.get('/workspaces', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) {
    return c.json({ error: 'user session required' }, 403);
  }

  const rows = await myMemberships(ctx);
  const usable = await usableWorkspaces(ctx.appId, rows);

  // The CHOICE, as recorded when somebody last switched — which is not always
  // what this token carries.
  //
  // The workspace lives in the access token, and each app on each apex holds
  // its own. Switching in one app records the choice here and refreshes THAT
  // app's token; every other open app keeps the workspace it was minted with
  // until its own token renews, up to an hour later. So The Fibre could say
  // soul.com while Business Models showed doab.ai, both correctly reporting
  // their own token, with nothing on screen admitting they disagreed.
  //
  // Sjoerd, 2026-09-27, after an evening of it: *"It should stay in the
  // workspace until I switch."* Returning both halves is what lets a client
  // notice the disagreement and end it. Nothing here CHANGES the token — a
  // read that quietly re-stamped identity would be a worse surprise than the
  // one it fixes.
  const { data: chosen } = await adminClient
    .from('user_active_workspace')
    .select('workspace_id')
    .eq('auth_user_id', ctx.authUserId)
    .maybeSingle();

  return c.json({
    // The one this token is acting in — not the stored choice. If the two ever
    // disagree, what the token says is what the request will actually do.
    active_workspace_id: ctx.workspaceId,
    // The one the person last chose. Null when they have never switched, in
    // which case there is nothing to reconcile.
    chosen_workspace_id: (chosen?.workspace_id as string | undefined) ?? null,
    workspaces: rows.map((r) => {
      const w = Array.isArray(r.workspace) ? r.workspace[0] : r.workspace;
      return {
        id: r.workspace_id,
        name: w?.name ?? null,
        slug: w?.slug ?? null,
        plan: w?.plan ?? null,
        is_active: r.workspace_id === ctx.workspaceId,
        // The one last chosen. Equal to is_active in the ordinary case; they
        // part company exactly when another app did the switching.
        is_chosen: r.workspace_id === (chosen?.workspace_id ?? ctx.workspaceId),
        // Whether the app ASKING can actually be used there. The Thread, Meet,
        // Flow and Pulse all bounce you to /no-access without a grant, so a
        // switcher that offered every workspace would be offering dead ends.
        has_app: usable === null || usable.has(r.workspace_id),
      };
    }),
  });
});

const SwitchBody = z.object({ workspace_id: z.string().uuid() });

authRoutes.post('/workspace', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId || !ctx.authUserId) {
    return c.json({ error: 'user session required' }, 403);
  }
  const body = SwitchBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  // Membership is the gate, and it is checked here rather than in RLS because
  // user_active_workspace has no policies at all — a client that could write
  // that table directly could put itself in any tenant on the platform.
  const rows = await myMemberships(ctx);
  const target = rows.find((r) => r.workspace_id === body.data.workspace_id);
  if (!target) {
    return c.json({ error: 'you are not a member of that workspace' }, 403);
  }

  const { error } = await adminClient
    .from('user_active_workspace')
    .upsert(
      {
        auth_user_id: ctx.authUserId,
        workspace_id: body.data.workspace_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id' },
    );
  if (error) {
    console.error('[auth/workspace] could not record the choice', error);
    return c.json({ error: error.message }, 500);
  }

  // The workspace lives in the token, so the caller has to get a new one
  // before anything changes. Said out loud rather than left to be discovered.
  return c.json({
    ok: true,
    workspace_id: body.data.workspace_id,
    refresh_required: true,
  });
});

authRoutes.get('/me', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: user, error } = await db
    .from('user')
    .select('id, email, full_name, avatar_url, person_id, workspace_id, primary_auth_method, last_sign_in, is_super_admin')
    .eq('id', ctx.userId)
    .is('deleted_at', null)
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Filter app_membership to apps the workspace has actually activated
  // (workspace_app row with deactivated_at IS NULL). A leftover membership
  // for an app that's currently off is dormant, not access — and showing
  // it on /settings made the page contradict /settings/apps (v0.13.10
  // fixed the same bug on the contact-profile endpoint).
  // One round trip for everything that needs only the user row: memberships,
  // the workspace's active apps, the workspace itself, the profile's locale.
  // Sequential until 2026-09-17, this was the slowest call every layout makes
  // (~500 ms measured), and every app made it on every server render.
  //
  // The locale is the interface language's durable copy (identity_profile);
  // the thefibre.locale cookie is per-browser — Sjoerd picked NL on his
  // desktop and his phone stayed English (2026-09-07) — so layouts resolve
  // cookie-first, THIS as the fallback. Non-fatal: /me must never fail over a
  // nicety, hence the catch to null.
  const [{ data: rawMemberships }, { data: activeApps }, { data: workspace }, profile] =
    await Promise.all([
      db
        .from('app_membership')
        .select('app_id, role, permissions, app:app_id (slug, name)')
        .eq('user_id', ctx.userId),
      db
        .from('workspace_app')
        .select('app_id')
        .eq('workspace_id', user.workspace_id)
        .is('deactivated_at', null),
      db
        .from('workspace')
        .select('id, slug, name, plan, created_at, archived_at')
        .eq('id', user.workspace_id)
        .single(),
      profileFor(ctx.userId).catch(() => null),
    ]);
  const activeAppIds = new Set((activeApps ?? []).map((r) => r.app_id as string));
  // fibre-platform is The Fibre itself — there's no workspace_app row for it
  // because you can't deactivate the platform from itself. Always include
  // it so the workspace-admin gate on /settings/apps keeps working.
  const memberships = (rawMemberships ?? []).filter((m) => {
    const appRow = Array.isArray(m.app) ? m.app[0] : m.app;
    if (appRow?.slug === 'fibre-platform') return true;
    return activeAppIds.has(m.app_id as string);
  });
  const locale: string | null = profile?.locale ?? null;
  // Whether this person wants the To do panel. Rides this call because every
  // app's topbar needs it on every server render, and /auth/me is already the
  // one round trip each layout makes. Missing profile → true, so a failure
  // here shows the panel rather than silently taking it away.
  const todoEnabled: boolean = profile?.todo_enabled ?? true;
  // And whether the WORKSPACE has To do at all — an Organisation-plan
  // feature (Sjoerd, 2026-09-23). Two different questions: this one is about
  // the plan, todo_enabled is the person's own switch. The button needs both.
  const todoAvailable: boolean = await can(user.workspace_id as string, 'todo').catch(() => false);

  // The person's role IN THIS WORKSPACE — not their app memberships, which is
  // a different question with a different answer.
  //
  // Added 2026-10-06. Settings → Members, Teams and Apps decided who may
  // manage a workspace by reading `app_membership.role === 'admin'` on the
  // fibre-platform app, because that was all this endpoint offered. The API
  // itself has always meant `workspace_member.workspace_role` (see
  // isWorkspaceAdmin in routes/connections-tags.ts). The two are different
  // fields and can disagree, so somebody made a workspace admin in the
  // ordinary way was still refused by the settings pages — which is what
  // happened to a real person in Festival of Trust. Sjoerd, asked which
  // should own those pages: "Workspace admin."
  //
  // Null when there is no seat row. Callers must read null as "not an admin"
  // rather than "unknown, allow" — canManageWorkspace does.
  const { data: seat } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('workspace_id', user.workspace_id as string)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  return c.json({
    user,
    /** Additive (rule 8): this person's role in the active workspace —
     *  'admin' | 'super_admin' | 'organiser' | null. */
    workspace_role: (seat?.workspace_role as string | undefined) ?? null,
    workspace,
    memberships,
    // Additive (rule 8): the signed-in interface language.
    locale,
    // Additive (rule 8): the To do panel's per-person on/off.
    todo_enabled: todoEnabled,
    // Additive (rule 8): whether the plan includes To do at all.
    todo_available: todoAvailable,
    app_id: ctx.appId,
    // Additive (rule 8): the 13-month Free archive — layouts steer archived
    // workspaces to Settings → Plan, where the reactivation banner lives.
    workspace_archived: Boolean(workspace?.archived_at),
  });
});

const MeUpdate = z.object({
  full_name: z.string().min(1).max(200).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});

authRoutes.patch('/me', async (c) => {
  const body = MeUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('user')
    .update(body.data)
    .eq('id', ctx.userId)
    .is('deleted_at', null)
    .select('id, email, full_name, avatar_url')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
