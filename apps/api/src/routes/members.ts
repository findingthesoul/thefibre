import { Hono } from 'hono';
import { seatAvailable, planFor } from '../lib/plan.js';
import { seatBillable, reconcileSeatBilling } from '../lib/seat-billing.js';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { rows } from '../lib/rows.js';
import { resolvePersonId } from '../lib/resolve-person.js';
import { sendEmail } from '../lib/email/client.js';
import { shell, escapeHtml } from '../lib/email/templates.js';
import { emailSignoff, appUrl } from '@thefibre/shared';
import {
  wouldOrphanWorkspace,
  ORPHAN_ERROR,
  isAdminRole,
  callerWorkspaceRole,
} from '../lib/workspace-roles.js';
import type { RequestContext } from '../middleware/app-context.js';
import { syncUsers, inheritedByUser } from '../lib/team-grants.js';
import { syncAutomaticTeams } from '../lib/automatic-teams.js';

// ===========================================================================
// Platform members management — THE single point of truth for who is in the
// workspace and which apps they can use (docs/platform-spot-members-profile.md,
// Phase A). Generalises Meet's internal-team invite mechanics: pending user +
// person + app grants + sign-in invite email. Apps render read-only views.
// ===========================================================================

export const membersRoutes = new Hono();

// Ask the catalogue, never a hardcoded list (the v0.14.0 rule — this WAS a
// stale allow-list: Pulse and Membership were missing, so their checkboxes
// never appeared on the Members page). First-party approved apps only;
// external apps reach the platform through app keys, not user grants.
let grantableCache: { slugs: string[]; at: number } | null = null;
async function grantableSlugs(): Promise<string[]> {
  if (grantableCache && Date.now() - grantableCache.at < 5 * 60 * 1000) {
    return grantableCache.slugs;
  }
  // Throws on a failed read — and so never CACHES a failure: an empty answer
  // here would have stripped every app checkbox off the Members page for
  // five minutes and looked like a workspace with nothing to grant.
  const data = rows(
    'grantable apps',
    await adminClient
      .from('app')
      .select('slug')
      .eq('status', 'approved')
      .eq('kind', 'first_party')
      .neq('slug', 'fibre-platform'),
  );
  const slugs = data.map((a) => a.slug);
  grantableCache = { slugs, at: Date.now() };
  return slugs;
}

// One grant entry: bare slug (role member) or {slug, role}. The role is
// APP-level: 'admin' manages that app's content without workspace admin
// (has_app_role gates in RLS — Membership first).
const AppGrant = z.union([
  z.string(),
  z.object({ slug: z.string(), role: z.enum(['member', 'admin']).default('member') }),
]);
type AppGrantIn = z.infer<typeof AppGrant>;
function normalizeGrants(list: AppGrantIn[]): { slug: string; role: 'member' | 'admin' }[] {
  return list.map((g) => (typeof g === 'string' ? { slug: g, role: 'member' as const } : { slug: g.slug, role: g.role }));
}

// Reconcile a user's DIRECT app grants against the wanted set. Sets the role
// explicitly (the UI always sends the full picture).
//
// Since teams became access groups (2026-09-11) an unticked app is no longer
// deleted outright — a team the person belongs to may still owe it to them.
// The tick is recorded as `is_direct` and lib/team-grants.ts decides what the
// row should finally be, so there is one resolver rather than two opinions.
async function syncAppGrants(userId: string, wanted: { slug: string; role: 'member' | 'admin' }[]) {
  const grantable = await grantableSlugs();
  const bySlug = new Map(wanted.filter((w) => grantable.includes(w.slug)).map((w) => [w.slug, w.role]));
  const { data: allApps } = await adminClient
    .from('app')
    .select('id, slug')
    .in('slug', grantable.length ? grantable : ['-']);
  for (const app of allApps ?? []) {
    const role = bySlug.get(app.slug);
    if (role) {
      await adminClient
        .from('app_membership')
        .upsert(
          { user_id: userId, app_id: app.id, role, is_direct: true },
          { onConflict: 'user_id,app_id' },
        );
    } else {
      await adminClient
        .from('app_membership')
        .update({ is_direct: false })
        .eq('user_id', userId)
        .eq('app_id', app.id);
    }
  }
  // Drops rows nothing owes any more, and re-applies whatever the person's
  // teams confer.
  await syncUsers([userId]);
}

membersRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const { data: members, error } = await adminClient
    .from('workspace_member')
    .select(
      'user_id, workspace_role, relationship_type, joined_at, user:user_id (id, full_name, email)',
    )
    .eq('workspace_id', ctx.workspaceId);
  if (error) return c.json({ error: error.message }, 500);

  const userIds = (members ?? []).map((m) => m.user_id);
  const grants = rows(
    'members: app grants',
    await adminClient
      .from('app_membership')
      .select('user_id, role, app:app_id (slug)')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
  );
  const appsByUser = new Map<string, { slug: string; role: string }[]>();
  for (const g of grants) {
    const app = Array.isArray(g.app) ? g.app[0] : g.app;
    if (!app || app.slug === 'fibre-platform') continue;
    const list = appsByUser.get(g.user_id) ?? [];
    list.push({ slug: app.slug, role: g.role });
    appsByUser.set(g.user_id, list);
  }

  // Which TEAMS each person is in. Additive (rule 8), and the thing the
  // member dialog is built on: an admin who opens a person wants to see the
  // way in — the teams — before the per-app exceptions underneath them.
  //
  // The automatic pair comes back with the rest, marked, rather than being
  // filtered out: the dialog SHOWS them, as fixed rows with a line saying
  // who decides them. Hiding them would leave an admin wondering why
  // somebody has an app that no team on screen confers.
  const teamRows = rows(
    'members: team memberships',
    await adminClient
      .from('team_member')
      .select('user_id, team:team_id (id, name, automatic, workspace_id, is_active)')
      .eq('status', 'active')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
  );
  const teamsByUser = new Map<string, { id: string; name: string; automatic: string | null }[]>();
  for (const row of teamRows) {
    const team = Array.isArray(row.team) ? row.team[0] : row.team;
    // Another workspace's team can reach this list through a person who
    // belongs to both — `team_member` has no workspace column of its own, so
    // the filter has to be here. An inactive team confers nothing and is not
    // shown either.
    if (!team || team.workspace_id !== ctx.workspaceId || team.is_active === false) continue;
    const list = teamsByUser.get(row.user_id) ?? [];
    list.push({ id: team.id, name: team.name, automatic: team.automatic ?? null });
    teamsByUser.set(row.user_id, list);
  }

  // Which of those apps a team confers, and which team — so an admin can see
  // WHY somebody has Pulse without hunting through the Teams page.
  const inherited = await inheritedByUser(userIds);
  const { data: appRows } = await adminClient.from('app').select('id, slug');
  const slugById = new Map((appRows ?? []).map((a) => [a.id, a.slug]));

  return c.json({
    items: (members ?? []).map((m) => {
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      return {
        user_id: m.user_id,
        full_name: u?.full_name ?? null,
        email: u?.email ?? null,
        workspace_role: m.workspace_role,
        relationship_type: m.relationship_type,
        joined_at: m.joined_at,
        apps: appsByUser.get(m.user_id) ?? [],
        teams: teamsByUser.get(m.user_id) ?? [],
        apps_via: (inherited.get(m.user_id) ?? [])
          .map((g) => ({ slug: slugById.get(g.app_id) ?? null, via: g.via }))
          .filter((g): g is { slug: string; via: string[] } => !!g.slug),
      };
    }),
  });
});

const MemberInvite = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  workspace_role: z.enum(['super_admin', 'admin', 'organiser']).default('organiser'),
  relationship_type: z.enum(['internal', 'external']).default('internal'),
  apps: z.array(AppGrant).default([]),
  /**
   * The teams this person joins. The normal way in (Sjoerd, 2026-10-06:
   * inviting somebody is picking their teams), with `apps` kept below it as
   * the exception for "give them this one app and nothing else".
   *
   * The two automatic teams are NOT taken from here: Everyone is joined by
   * being a member at all, and Admins follows the workspace role. Passing
   * either is accepted and ignored rather than refused — a caller asking for
   * what already happens is not an error, and refusing would make the
   * obvious UI (show Everyone ticked, send what is ticked) fail.
   */
  teams: z.array(z.string().uuid()).default([]),
  /**
   * "If you go beyond a free seat, you accept the monthly extra pay" (Sjoerd,
   * 2026-09-04). When the invite would add a PAID seat, the first request
   * comes back 402 with `requires_seat_confirmation` + the server-computed
   * cost; the UI re-submits with this flag after the admin explicitly
   * confirms. Never trusted for the price — only for the consent.
   */
  accept_seat_cost: z.boolean().default(false),
});

membersRoutes.post('/', async (c) => {
  const body = MemberInvite.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  // Same gate as DELETE (2026-09-05): the page redirect alone guarded these,
  // so a direct API call from an organiser could invite/change members.
  if (!isAdminRole(await callerWorkspaceRole(ctx))) {
    return c.json({ error: 'only admins can invite members' }, 403);
  }
  const email = body.data.email.trim().toLowerCase();

  // Already a member OF THIS WORKSPACE?
  //
  // Scoped to the workspace, and no longer refusing someone who belongs to
  // another. Since v0.19.1 one person can hold a user row in several
  // workspaces — that is the feature — so "already in another workspace" is
  // now an ordinary fact about a colleague, not a reason to turn them away.
  //
  // The scope also fixes a real break: unscoped, `.eq('email', …)` returns
  // several rows for such a person, maybeSingle() treats that as an ERROR
  // rather than a result, and the invite would have read them as brand new.
  // `unique (workspace_id, email)` makes maybeSingle() safe once scoped.
  let { data: u } = await adminClient
    .from('user')
    .select('id, email, full_name, workspace_id')
    .eq('email', email)
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .maybeSingle();

  // A previously REMOVED member leaves a soft-deleted user row behind, and
  // `unique (workspace_id, email)` means a fresh insert would collide with
  // it. Re-inviting them resurrects that row instead — same user id, same
  // person link — and reopens a seat, so it walks through the same seat gate
  // as a brand-new colleague.
  let removed: typeof u = null;
  if (!u) {
    const { data: dead } = await adminClient
      .from('user')
      .select('id, email, full_name, workspace_id')
      .eq('email', email)
      .eq('workspace_id', ctx.workspaceId)
      .not('deleted_at', 'is', null)
      .maybeSingle();
    removed = dead ?? null;
  }

  let isNew = false;
  if (!u) {
    // A seat is somebody who RUNS events. Participants are never seats and
    // never become one by enrolling, so this only ever counts colleagues.
    //
    // Checked here, where a NEW seat is about to exist — a workspace already
    // over its allowance keeps everybody it has. The limit binds on the next
    // invite, never retroactively; nobody is removed by a pricing change.
    //
    // Since seat billing (v0.22.0): a workspace with a live Stripe
    // subscription is not REFUSED the seat — it is CHARGED for it (€8/mo,
    // prorated, as a quantity on the subscription). The 402 remains for
    // workspaces with nothing to charge: Free, comped, unpaid.
    const seat = await seatAvailable(ctx.workspaceId);
    if (!seat.ok) {
      const billNewSeat = await seatBillable(ctx.workspaceId);
      const plan = await planFor(ctx.workspaceId);
      if (!billNewSeat) {
        const extra = seat.extraCents
          ? ` Extra seats are €${(seat.extraCents / 100).toFixed(0)} each per month.`
          : '';
        return c.json(
          {
            error: `${plan.name} includes ${seat.included} ${seat.included === 1 ? 'seat' : 'seats'} and ${seat.used} are in use.${extra}`,
            plan: plan.name,
            seats_used: seat.used,
            seats_included: seat.included,
          },
          402,
        );
      }
      // The seat CAN be billed — but never silently. The admin must accept
      // the recurring cost first (decided 2026-09-04). The price is computed
      // HERE, from the billing plan; the client only ever echoes consent
      // back, never the number.
      if (!body.data.accept_seat_cost) {
        const costCents = seat.extraCents ?? plan.extraSeatCentsMonth;
        return c.json(
          {
            error:
              costCents != null
                ? `This invite adds €${(costCents / 100).toFixed(costCents % 100 === 0 ? 0 : 2)}/month to your subscription.`
                : 'This invite adds a paid seat to your subscription.',
            code: 'seat-cost-confirmation-required',
            requires_seat_confirmation: true,
            seat_cost_cents_month: costCents ?? null,
            currency: 'EUR',
            plan: plan.name,
            seats_used: seat.used,
            seats_included: seat.included,
          },
          402,
        );
      }
    }
    isNew = true;
    if (removed) {
      // Same colleague, same row, seat reopened. Clearing deleted_at is the
      // whole resurrection — person link and email survive removal intact.
      const { error: rErr } = await adminClient
        .from('user')
        .update({
          deleted_at: null,
          ...(body.data.name ? { full_name: body.data.name } : {}),
        })
        .eq('id', removed.id)
        .eq('workspace_id', ctx.workspaceId);
      if (rErr) {
        console.error('[members] user resurrect failed', rErr);
        return c.json({ error: rErr.message }, 500);
      }
      u = removed;
    }
  }

  if (isNew && !u) {
    // Identity invariant: every user has a paired person.
    const personId = await resolvePersonId({
      workspaceId: ctx.workspaceId,
      email,
      name: body.data.name,
      source: 'member_invite',
      create: true,
    });
    const { data: createdUser, error: uErr } = await adminClient
      .from('user')
      .insert({
        workspace_id: ctx.workspaceId,
        person_id: personId,
        email,
        full_name: body.data.name ?? null,
        primary_auth_method: 'google',
        email_verified: false,
      })
      .select('id, email, full_name, workspace_id')
      .single();
    if (uErr || !createdUser) {
      console.error('[members] user create failed', uErr);
      return c.json({ error: uErr?.message ?? 'create failed' }, 500);
    }
    u = createdUser;
    if (personId) {
      await adminClient.from('person').update({ user_id: u.id }).eq('id', personId);
    }
  }

  // Belt for the type-checker and for a truly impossible fall-through: every
  // path above either assigned `u` or returned.
  if (!u) return c.json({ error: 'invite failed' }, 500);

  // Workspace membership. AN INVITE NEVER LOWERS AN EXISTING ROLE.
  //
  // This was a plain upsert of the form's values, so re-inviting a colleague
  // — to add them to a team, say, with the role select sitting at its
  // `organiser` default — silently demoted an admin. No warning, no record,
  // and nothing on the screen to suggest it had happened. The same went for
  // `relationship_type`: an invite form's default would overwrite a stated
  // internal relationship with external.
  //
  // Found on 2026-10-14 while working out how Sjoerd's own row in the
  // soul.com workspace came to read "Organiser (default)" / "External" in a
  // workspace he founded. This is not proof that is what happened to him —
  // there is no audit trail to prove it either way — but it is a path that
  // does it, and it should not exist.
  //
  // So the form's values apply to a NEW row only. Changing an existing
  // member's role is what PATCH /members/:userId is for, where the orphan
  // guard and (now) the activity record live. Raising a role is not special-
  // cased either: an invite is not the place to promote somebody, and
  // "sometimes it changes the role" is harder to reason about than "never".
  const existingMembership = await adminClient
    .from('workspace_member')
    .select('workspace_role, relationship_type')
    .eq('user_id', u.id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (existingMembership.error) {
    return c.json({ error: `membership lookup: ${existingMembership.error.message}` }, 500);
  }
  if (!existingMembership.data) {
    const { error: insErr } = await adminClient.from('workspace_member').insert({
      user_id: u.id,
      workspace_id: ctx.workspaceId,
      workspace_role: body.data.workspace_role,
      relationship_type: body.data.relationship_type,
    });
    // 23505 means a concurrent invite created the row between the read and
    // the insert. The other row is as good as this one would have been, and
    // keeping it is the same rule as above: an existing row is not rewritten.
    if (insErr && insErr.code !== '23505') {
      return c.json({ error: `membership: ${insErr.message}` }, 500);
    }
  }

  // The teams they were invited into. Before syncAutomaticTeams, so one
  // resolve covers both these and the automatic membership.
  if (body.data.teams.length) {
    // Scoped to this workspace, and automatic teams dropped: membership of
    // those is decided by the workspace, not by a request body. A forged or
    // stale id therefore adds nothing rather than adding somebody to another
    // workspace's team.
    const { data: ok } = await adminClient
      .from('team')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .is('automatic', null)
      .in('id', body.data.teams);
    const ids = (ok ?? []).map((t) => t.id as string);
    if (ids.length) {
      // JOIN THE TEAMS THEY ARE NOT IN, and leave the rest alone.
      //
      // This upserted `role: 'member'`, so re-inviting a colleague — the
      // ordinary way to add somebody to one more team — DEMOTED them in every
      // team they were already in, including ones where they were the admin.
      // The same bug as the workspace role (fixed in v1.181.0) and the same
      // rule: 'member' here is a default for a new row, never a statement
      // about an existing one. Changing somebody's role in a team is the
      // team's own screen.
      const already = await adminClient
        .from('team_member')
        .select('team_id, status')
        .eq('user_id', u.id)
        .in('team_id', ids);
      if (already.error) {
        return c.json({ error: `team membership lookup: ${already.error.message}` }, 500);
      }
      const statusOf = new Map(
        (already.data ?? []).map((r) => [r.team_id as string, r.status as string | null]),
      );
      const missing = ids.filter((id) => !statusOf.has(id));
      if (missing.length) {
        const { error } = await adminClient.from('team_member').insert(
          missing.map((team_id) => ({ team_id, user_id: u.id, role: 'member', status: 'active' })),
        );
        // 23505: a concurrent invite got there first, which is the outcome
        // this wanted anyway.
        if (error && error.code !== '23505') {
          return c.json({ error: `team membership: ${error.message}` }, 500);
        }
      }

      // AND A PENDING ROW IS STILL ACTIVATED — status yes, role never.
      //
      // `team_member.status` is `check (status in ('active', 'invited'))`:
      // 'invited' is a team lead's two-step invite awaiting the person's own
      // Accept. There is no 'removed' — leaving a team is a delete.
      //
      // Skipping every existing row, as the fix above first did, would have
      // left such a row pending: an admin ticks the team on the invite form,
      // the screen says they are in it, and they are not. The old upsert set
      // status alongside role, so this behaviour existed and was lost by
      // accident rather than by decision.
      //
      // The two fields are not alike. A ROLE is a standing fact about
      // somebody that an admin ticking a team box is not making a statement
      // about. STATUS is precisely what the box is for, and an admin has the
      // authority to put a colleague in a team directly — which is why a new
      // row is created 'active' and does not wait for an Accept either.
      const pending = (already.data ?? [])
        .filter((r) => r.status !== 'active')
        .map((r) => r.team_id as string);
      if (pending.length) {
        const { error } = await adminClient
          .from('team_member')
          .update({ status: 'active' })
          .eq('user_id', u.id)
          .in('team_id', pending);
        if (error) {
          return c.json({ error: `team membership activate: ${error.message}` }, 500);
        }
      }
    }
  }

  // Everyone gains a member, and Admins may have too. Same one writer.
  await syncAutomaticTeams(ctx.workspaceId);

  // App grants — additive on invite (never strips grants the user already
  // holds from another workspace context).
  const wanted = normalizeGrants(body.data.apps);
  if (wanted.length) {
    const grantable = await grantableSlugs();
    const usable = wanted.filter((w) => grantable.includes(w.slug));
    const { data: apps } = await adminClient
      .from('app')
      .select('id, slug')
      .in('slug', usable.length ? usable.map((w) => w.slug) : ['-']);
    // GRANT WHAT THEY DO NOT HAVE, and do not re-rank what they do.
    //
    // Same rule as the workspace role and the teams above: this upserted the
    // form's role, which defaults to 'member', so re-inviting somebody who
    // was an ADMIN of an app quietly made them an ordinary member of it. The
    // invite adds access; `PATCH /members/:userId` with `apps` is what
    // replaces grants and roles, and it says so.
    const existingGrants = await adminClient
      .from('app_membership')
      .select('app_id')
      .eq('user_id', u.id)
      .in('app_id', (apps ?? []).map((a) => a.id as string));
    if (existingGrants.error) {
      return c.json({ error: `app grant lookup: ${existingGrants.error.message}` }, 500);
    }
    const granted = new Set((existingGrants.data ?? []).map((r) => r.app_id as string));
    for (const app of apps ?? []) {
      if (granted.has(app.id as string)) continue;
      const role = usable.find((w) => w.slug === app.slug)?.role ?? 'member';
      const { error } = await adminClient
        .from('app_membership')
        .insert({ user_id: u.id, app_id: app.id, role, is_direct: true });
      if (error && error.code !== '23505') {
        return c.json({ error: `app grant: ${error.message}` }, 500);
      }
    }
  }

  // Invite email for fresh users.
  if (isNew) {
    const fibreUrl = appUrl('fibre-platform', process.env as Record<string, string>);
    const first = (body.data.name ?? '').split(/\s+/)[0] || '';
    const text = `Hi ${first},

You've been invited to The Fibre workspace. Sign in with this email address to get started:

${fibreUrl}/sign-in

${emailSignoff()}`;
    const html = shell(
      "You're invited",
      `
        <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(first)},</p>
        <p style="margin:0 0 16px;font-size:15px;">You've been invited to The Fibre workspace. Sign in with this email address to get started.</p>
        <p style="margin:24px 0;">
          <a href="${fibreUrl}/sign-in" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Sign in</a>
        </p>
        <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
      `,
    );
    try {
      await sendEmail({ to: email, subject: "You're invited to The Fibre", text, html });
    } catch (e) {
      console.warn('[members] invite email failed', e);
    }
  }

  // A new seat may have crossed the allowance — put it on the subscription.
  // Fire-and-forget and idempotent; a Stripe hiccup never blocks the invite.
  if (isNew) void reconcileSeatBilling(ctx.workspaceId);

  return c.json({ ok: true, user_id: u.id, invited: isNew }, 201);
});

const MemberPatch = z.object({
  workspace_role: z.enum(['super_admin', 'admin', 'organiser']).optional(),
  relationship_type: z.enum(['internal', 'external']).optional(),
  /** Replace the user's app grants incl. app-level roles (fibre-platform
   *  is never touched). Bare strings mean role 'member'. */
  apps: z.array(AppGrant).optional(),
});

membersRoutes.patch('/:userId', async (c) => {
  const body = MemberPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!isAdminRole(await callerWorkspaceRole(ctx))) {
    return c.json({ error: 'only admins can change members' }, 403);
  }
  const userId = c.req.param('userId');

  // Scope check: the target must be a member of this workspace.
  const { data: member } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return c.json({ error: 'not found' }, 404);

  // A workspace with no admin cannot be repaired from any screen — every one
  // of them is behind an admin check. Refuse the demotion that would cause it.
  if (
    body.data.workspace_role &&
    (await wouldOrphanWorkspace(userId, ctx.workspaceId, body.data.workspace_role))
  ) {
    return c.json({ error: ORPHAN_ERROR }, 409);
  }

  const patch: Record<string, unknown> = {};
  if (body.data.workspace_role) patch.workspace_role = body.data.workspace_role;
  if (body.data.relationship_type) patch.relationship_type = body.data.relationship_type;
  if (Object.keys(patch).length) {
    const { error } = await adminClient
      .from('workspace_member')
      .update(patch)
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 500);
  }

  if (body.data.apps) {
    // The UI sends the full grant picture incl. roles — reconcile against it.
    await syncAppGrants(userId, normalizeGrants(body.data.apps));
  }

  // The workspace's role just changed, so the Admins team is stale. ONE
  // writer, called from every path that touches workspace_member — see
  // lib/automatic-teams.ts. Missing a path leaves somebody holding
  // admin-level app access after a demotion, which is silent.
  await syncAutomaticTeams(ctx.workspaceId);

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Remove a member — the path that finally lets a seat CLOSE (build-plan P4,
// decided 2026-09-04).
//
// Removal is SOFT, per the platform rule: the workspace's `user` row gets
// `deleted_at` (never a hard delete — it is the seat AND personal data), which
// is exactly what `seatsUsed` counts, so the seat stops existing the moment
// the row is soft-deleted. The workspace_member edge and the per-row app
// grants are relationship state, not personal data — they are removed the way
// syncAppGrants already removes grants. The PERSON stays: a removed colleague
// remains a contact in the graph.
//
// JWT effect: custom_access_token_hook filters `deleted_at is null`, so on the
// next token refresh this workspace stops resolving for them — the hook falls
// back to their earliest remaining workspace, or to no claims at all (RLS then
// denies everything) if this was their only one.
//
// Billing: reconcileSeatBilling runs after — and a quantity SHRINK uses
// proration_behavior 'none', so the removed seat stops billing from the NEXT
// period with no mid-month credit. Re-inviting the same email resurrects the
// same user row (see POST above).
// ---------------------------------------------------------------------------
membersRoutes.delete('/:userId', async (c) => {
  const ctx = c.get('ctx');
  // App keys never reach /members (default-deny route table), but the check
  // costs nothing and documents that removal is a human admin's act.
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 403);
  if (!isAdminRole(await callerWorkspaceRole(ctx))) {
    return c.json({ error: 'removing a member needs an admin role' }, 403);
  }
  const userId = c.req.param('userId');

  const { data: member } = await adminClient
    .from('workspace_member')
    .select('user_id, workspace_role')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return c.json({ error: 'not found' }, 404);

  // Guard rails. The last super admin can't go — nobody would be left who can
  // hand out the role. And removal is the demotion-to-nothing case of the
  // orphan rule: the workspace must keep at least one admin-class member.
  if (member.workspace_role === 'super_admin') {
    const { count } = await adminClient
      .from('workspace_member')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('workspace_role', 'super_admin');
    if ((count ?? 0) <= 1) {
      return c.json(
        { error: 'this is the workspace’s only super admin — promote someone else first' },
        409,
      );
    }
  }
  if (await wouldOrphanWorkspace(userId, ctx.workspaceId, 'organiser')) {
    return c.json({ error: ORPHAN_ERROR }, 409);
  }

  // Soft-delete the user row — scoped to THIS workspace; the same person's
  // rows in other workspaces are untouched.
  const { error: delErr } = await adminClient
    .from('user')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('workspace_id', ctx.workspaceId);
  if (delErr) return c.json({ error: delErr.message }, 500);

  // Membership edge + app grants go with the seat (grants belong to the
  // per-workspace user row, so this strips nothing in any other workspace).
  await adminClient
    .from('workspace_member')
    .delete()
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', userId);
  await adminClient.from('app_membership').delete().eq('user_id', userId);

  // Seat count just shrank — shrink the subscription quantity (no credit;
  // next period). Fire-and-forget: a Stripe hiccup never blocks the removal.
  void reconcileSeatBilling(ctx.workspaceId);

  return c.json({ ok: true });
});
