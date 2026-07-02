import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';
import { sendEmail } from '../lib/email/client.js';
import { shell, escapeHtml } from '../lib/email/templates.js';
import { emailSignoff, appUrl } from '@thefibre/shared';

// ===========================================================================
// Platform members management — THE single point of truth for who is in the
// workspace and which apps they can use (docs/platform-spot-members-profile.md,
// Phase A). Generalises Meet's internal-team invite mechanics: pending user +
// person + app grants + sign-in invite email. Apps render read-only views.
// ===========================================================================

export const membersRoutes = new Hono();

const GRANTABLE = ['fibre-meet', 'the-thread', 'fibre-flow', 'fibre-sales', 'fibre-learn'];

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
  const { data: grants } = await adminClient
    .from('app_membership')
    .select('user_id, role, app:app_id (slug)')
    .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const appsByUser = new Map<string, { slug: string; role: string }[]>();
  for (const g of grants ?? []) {
    const app = Array.isArray(g.app) ? g.app[0] : g.app;
    if (!app || app.slug === 'fibre-platform') continue;
    const list = appsByUser.get(g.user_id) ?? [];
    list.push({ slug: app.slug, role: g.role });
    appsByUser.set(g.user_id, list);
  }

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
      };
    }),
  });
});

const MemberInvite = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  workspace_role: z.enum(['admin', 'member']).default('member'),
  relationship_type: z.enum(['internal', 'external']).default('internal'),
  apps: z.array(z.string()).default([]),
});

membersRoutes.post('/', async (c) => {
  const body = MemberInvite.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const email = body.data.email.trim().toLowerCase();

  // Existing user?
  let { data: u } = await adminClient
    .from('user')
    .select('id, email, full_name, workspace_id')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (u && u.workspace_id !== ctx.workspaceId) {
    return c.json({ error: 'that email already belongs to another Fibre workspace' }, 409);
  }

  let isNew = false;
  if (!u) {
    isNew = true;
    // Identity invariant: every user has a paired person.
    let { data: person } = await adminClient
      .from('person')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (!person) {
      const parts = (body.data.name ?? '').trim().split(/\s+/);
      const { data: created } = await adminClient
        .from('person')
        .insert({
          workspace_id: ctx.workspaceId,
          first_name: parts[0] || null,
          last_name: parts.slice(1).join(' ') || null,
          email,
        })
        .select('id')
        .single();
      person = created;
    }
    const { data: createdUser, error: uErr } = await adminClient
      .from('user')
      .insert({
        workspace_id: ctx.workspaceId,
        person_id: person?.id ?? null,
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
    if (person) {
      await adminClient.from('person').update({ user_id: u.id }).eq('id', person.id);
    }
  }

  // Workspace membership.
  await adminClient.from('workspace_member').upsert(
    {
      user_id: u.id,
      workspace_id: ctx.workspaceId,
      workspace_role: body.data.workspace_role,
      relationship_type: body.data.relationship_type,
    },
    { onConflict: 'user_id,workspace_id' },
  );

  // App grants.
  const slugs = body.data.apps.filter((s) => GRANTABLE.includes(s));
  if (slugs.length) {
    const { data: apps } = await adminClient.from('app').select('id, slug').in('slug', slugs);
    for (const app of apps ?? []) {
      await adminClient
        .from('app_membership')
        .upsert({ user_id: u.id, app_id: app.id, role: 'member' }, { onConflict: 'user_id,app_id' });
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

  return c.json({ ok: true, user_id: u.id, invited: isNew }, 201);
});

const MemberPatch = z.object({
  workspace_role: z.enum(['admin', 'member']).optional(),
  relationship_type: z.enum(['internal', 'external']).optional(),
  /** Replace the user's app grants (fibre-platform is never touched). */
  apps: z.array(z.string()).optional(),
});

membersRoutes.patch('/:userId', async (c) => {
  const body = MemberPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const userId = c.req.param('userId');

  // Scope check: the target must be a member of this workspace.
  const { data: member } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return c.json({ error: 'not found' }, 404);

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
    const slugs = body.data.apps.filter((s) => GRANTABLE.includes(s));
    const { data: allApps } = await adminClient
      .from('app')
      .select('id, slug')
      .in('slug', GRANTABLE);
    for (const app of allApps ?? []) {
      if (slugs.includes(app.slug)) {
        await adminClient
          .from('app_membership')
          .upsert(
            { user_id: userId, app_id: app.id, role: 'member' },
            { onConflict: 'user_id,app_id' },
          );
      } else {
        await adminClient
          .from('app_membership')
          .delete()
          .eq('user_id', userId)
          .eq('app_id', app.id);
      }
    }
  }

  return c.json({ ok: true });
});
