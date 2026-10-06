// Your domain — the workspace's own sender domain, and later its own web
// address (docs/domain-package.md). Mounted at /api/v1/workspace-domain.
//
// The admin types a domain; THIS process registers it with the mail provider
// using the server's key, stores what the provider answers (the DNS records
// to add, each with its status), and reads the verdict back on "Check". The
// admin never sees a key and never talks to the provider; what they see is a
// table of records with copy buttons and a status per row.
//
// Admin-or-above, and the plan has to carry `custom_sender_domain` (Pro and
// up) — the same 402 shape every gate here uses. The sender ADDRESS and
// reply-to themselves still live on the workspace row (PATCH /workspace);
// the settings page saves both halves, this file owns the domain.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { can, planFor, needsPlan } from '../lib/plan.js';
import { row } from '../lib/rows.js';
import { resendDomains } from '../lib/resend-domains.js';
import { plainResendError } from '../lib/resend-domains.js';
import {
  emailDomainOf,
  fullRecordName,
  normaliseHost,
  rowPatchFromResend,
  type WorkspaceDomainRow,
} from '../lib/workspace-domain.js';

export const workspaceDomainRoutes = new Hono();

async function isAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

/** The row as the page sees it: the provider's records with the FULL DNS
 *  name beside the relative one, because registrars differ on which they
 *  want and people copy the wrong one. */
function view(r: WorkspaceDomainRow | null) {
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    host: r.host,
    provider: r.provider,
    status: r.status,
    verified_at: r.verified_at,
    checked_at: r.checked_at,
    created_at: r.created_at,
    records: (r.records ?? []).map((rec) => ({
      ...rec,
      full_name: fullRecordName(rec.name, r.host),
    })),
  };
}

workspaceDomainRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const [email, allowed] = await Promise.all([
    emailDomainOf(ctx.workspaceId),
    can(ctx.workspaceId, 'custom_sender_domain'),
  ]);
  return c.json({
    email: view(email),
    // What the page may offer: a workspace below Pro sees the explanation
    // and the plan link, not a form that 402s on submit.
    can_sender_domain: allowed,
    can_web_domain: await can(ctx.workspaceId, 'custom_domain'),
    provider_configured: resendDomains() !== null,
  });
});

const EmailBody = z.object({ domain: z.string().min(3).max(253) });

workspaceDomainRoutes.post('/email', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'only a workspace admin can set up its domain' }, 403);
  }
  if (!(await can(ctx.workspaceId, 'custom_sender_domain'))) {
    const plan = await planFor(ctx.workspaceId);
    return c.json({ error: needsPlan('Sending from your own domain', 'Pro'), plan: plan.name }, 402);
  }
  const body = EmailBody.safeParse(await c.req.json().catch(() => null));
  const host = body.success ? normaliseHost(body.data.domain) : null;
  if (!host) return c.json({ error: 'Enter a domain like yourdomain.com — the part after the @, nothing else.' }, 400);

  const provider = resendDomains();
  if (!provider) return c.json({ error: 'Email is not configured on this server.' }, 503);

  // One row per workspace for email. Starting over with another domain
  // removes the previous registration at the provider too, or it would sit
  // there holding the name against the next workspace that wants it.
  const existing = await emailDomainOf(ctx.workspaceId);
  if (existing && existing.host === host) return c.json({ email: view(existing), unchanged: true });

  // Somebody else's already? The unique index would refuse the insert with a
  // Postgres error; say it in words first.
  const taken = row(
    'workspace_domain taken?',
    await adminClient.from('workspace_domain').select('workspace_id').eq('kind', 'email').eq('host', host).maybeSingle(),
  ) as { workspace_id: string } | null;
  if (taken && taken.workspace_id !== ctx.workspaceId) {
    return c.json({ error: 'Another workspace on this platform already uses this domain for its email.' }, 409);
  }

  let created;
  try {
    created = await provider.create(host);
  } catch (e) {
    console.warn('[workspace-domain] resend create refused', host, e instanceof Error ? e.message : e);
    const { status, error } = plainResendError(e);
    return c.json({ error }, status);
  }

  if (existing) {
    // Best effort: a stale registration at the provider is clutter, not a
    // failure the admin can do anything about.
    if (existing.provider_id) await provider.remove(existing.provider_id).catch(() => undefined);
    const { error } = await adminClient.from('workspace_domain').delete().eq('id', existing.id);
    if (error) console.error('[workspace-domain] could not drop the previous row', error);
  }

  const patch = rowPatchFromResend(created);
  const { data, error } = await adminClient
    .from('workspace_domain')
    .insert({ workspace_id: ctx.workspaceId, kind: 'email', host, provider: 'resend', ...patch })
    .select('*')
    .single();
  if (error) {
    console.error('[workspace-domain] insert failed', error);
    // The provider now holds a domain we have no row for; take it back.
    await provider.remove(created.id).catch(() => undefined);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ email: view(data as WorkspaceDomainRow) }, 201);
});

/** "Check": ask the provider to look at the DNS again, then read what it
 *  found. Verification is asynchronous on their side — the domain reads
 *  `pending` for a while — so the page may need a second press. */
workspaceDomainRoutes.post('/email/check', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'only a workspace admin can check its domain' }, 403);
  }
  const existing = await emailDomainOf(ctx.workspaceId);
  if (!existing?.provider_id) return c.json({ error: 'No domain to check. Add one first.' }, 404);
  const provider = resendDomains();
  if (!provider) return c.json({ error: 'Email is not configured on this server.' }, 503);

  try {
    // A domain the provider already calls verified needs no new round; asking
    // again flips it to pending for nothing.
    if (existing.status !== 'verified') await provider.verify(existing.provider_id);
    const fresh = await provider.get(existing.provider_id);
    const patch = rowPatchFromResend(fresh);
    // Keep the first verified_at; a re-check must not move the date.
    if (existing.verified_at) delete (patch as { verified_at?: string }).verified_at;
    const { data, error } = await adminClient
      .from('workspace_domain')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) {
      console.error('[workspace-domain] check update failed', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ email: view(data as WorkspaceDomainRow) });
  } catch (e) {
    console.warn('[workspace-domain] resend check refused', existing.host, e instanceof Error ? e.message : e);
    const { status, error } = plainResendError(e);
    return c.json({ error }, status);
  }
});

workspaceDomainRoutes.delete('/email', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'only a workspace admin can remove its domain' }, 403);
  }
  const existing = await emailDomainOf(ctx.workspaceId);
  if (!existing) return c.json({ ok: true, unchanged: true });
  const provider = resendDomains();
  if (provider && existing.provider_id) {
    try {
      await provider.remove(existing.provider_id);
    } catch (e) {
      // Already gone at the provider is fine; anything else is said, and the
      // row still goes, because the admin asked for the domain to stop.
      console.warn('[workspace-domain] resend delete', existing.host, e instanceof Error ? e.message : e);
    }
  }
  const { error } = await adminClient.from('workspace_domain').delete().eq('id', existing.id);
  if (error) {
    console.error('[workspace-domain] delete failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true });
});
