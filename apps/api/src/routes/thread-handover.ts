// Handing ONE thread to another organiser, with both of them saying yes.
//
// Sjoerd, 2026-10-14: "change organiser for a thread. With approval from the
// departing organiser and the new one." Design and decisions:
// docs/organiser-handover-design.md.
//
//   POST /thread/threads/:id/handover        propose (the organiser), or the
//                                            second door (an admin, for an
//                                            organiser who has left)
//   GET  /thread/handovers                   mine — incoming and outgoing
//   POST /thread/handovers/:id/accept        the proposed organiser
//   POST /thread/handovers/:id/decline       the proposed organiser
//   POST /thread/handovers/:id/cancel        the proposer
//
// THE SWITCH ITSELF is one SQL function, accept_thread_handover (born closed),
// so everything that must change together does. What calls out — the rooms,
// the calendar notices, the mail — runs here after it commits.
//
// Every query filters workspace_id explicitly: these run on the service role,
// which RLS does not see (handbook §2).

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { isWorkspaceMember } from '../lib/workspace-refs.js';
import { paymentRouteProblem } from '../lib/thread-payment-route.js';
import { threadDestinationAccount } from '../lib/payment-accounts.js';
import { propagateRoom, threadRoom } from '../lib/main-facilitator.js';
import { sendEmail } from '../lib/email/client.js';
import { escapeHtml } from '../lib/email/templates.js';
import { workspaceSender } from '../lib/workspace-brand.js';
import { appUrl } from '@thefibre/shared';
import { provisionOrganiser, threadLocked } from './thread.js';

export const threadHandoverRoutes = new Hono();

/** Sjoerd, 2026-10-16: a request expires after seven days. */
export const HANDOVER_DAYS = 7;

const Propose = z.object({
  to_user_id: z.string().uuid(),
  keep_as_host: z.boolean().optional(),
  door: z.enum(['organiser', 'admin_departed']).optional(),
  reason: z.string().trim().max(1000).optional(),
});

type HandoverRow = {
  id: string;
  workspace_id: string;
  thread_id: string;
  from_organiser_id: string;
  to_organiser_id: string;
  proposed_by_user_id: string;
  door: 'organiser' | 'admin_departed';
  reason: string | null;
  keep_as_host: boolean;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  expires_at: string;
  decided_at: string | null;
  created_at: string;
};

/** A stored 'pending' past its expiry IS expired — checked, not swept. */
export function effectiveStatus(h: Pick<HandoverRow, 'status' | 'expires_at'>, now = new Date()): HandoverRow['status'] {
  return h.status === 'pending' && Date.parse(h.expires_at) <= now.getTime() ? 'expired' : h.status;
}

const threadUrl = () => appUrl('the-thread', process.env as Record<string, string>);

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** An organiser as a person reads them: their display name, else the
 *  account's name, else its address. Never empty when there is a person. */
export function personName(org: unknown): string | null {
  const o = one(org as { display_name?: string | null; user?: unknown } | null);
  if (!o) return null;
  const u = one(o.user as { full_name?: string | null; email?: string | null } | null);
  return o.display_name?.trim() || u?.full_name?.trim() || u?.email || null;
}

async function organiserOf(userId: string): Promise<{ id: string; user_id: string; slug: string | null; display_name: string | null } | null> {
  const { data } = await adminClient
    .from('thread_organiser')
    .select('id, user_id, slug, display_name')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { id: string; user_id: string; slug: string | null; display_name: string | null } | null) ?? null;
}

async function userContact(userId: string | null): Promise<{ email: string | null; name: string | null }> {
  if (!userId) return { email: null, name: null };
  const { data } = await adminClient.from('user').select('email, full_name').eq('id', userId).maybeSingle();
  return { email: (data?.email as string | null) ?? null, name: (data?.full_name as string | null) ?? null };
}

async function threadTitle(threadId: string): Promise<string> {
  const { data } = await adminClient
    .from('thread_thread')
    .select('slug, program:program_id (title)')
    .eq('id', threadId)
    .maybeSingle();
  const p = (Array.isArray(data?.program) ? data?.program[0] : data?.program) as { title?: string } | null;
  return p?.title ?? (data?.slug as string | undefined) ?? 'a thread';
}

async function mail(workspaceId: string, to: string | null, subject: string, text: string): Promise<void> {
  if (!to) return;
  try {
    const html = `<p style="font-size:14px;line-height:1.6;color:#171717;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
    await sendEmail({ to, subject, text, html, ...(await workspaceSender(workspaceId)) });
  } catch (e) {
    // Never fatal: the request and its state are what matter; the card in
    // Thread shows it either way.
    console.error('[thread/handover] mail failed (non-fatal)', { to, subject, error: e });
  }
}

/** What a paid, live thread needs before it can belong to `userId`: the
 *  payment check run AS IF they were its organiser (point 7). Null = fine. */
async function paymentProblemFor(threadId: string, userId: string): Promise<string | null> {
  return paymentRouteProblem(threadId, { organiserUserId: userId });
}

// ---------------------------------------------------------------------------
// Propose
// ---------------------------------------------------------------------------
threadHandoverRoutes.post('/threads/:id/handover', async (c) => {
  const ctx = c.get('ctx');
  const body = Propose.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const door = body.data.door ?? 'organiser';
  const threadId = c.req.param('id');

  const { data: thread } = await adminClient
    .from('thread_thread')
    .select('id, workspace_id, organiser_id, team_id')
    .eq('id', threadId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!thread) return c.json({ error: 'not found' }, 404);
  if (await threadLocked(threadId)) {
    return c.json({ error: 'this thread is locked. Unlock it in Settings to make changes.', code: 'thread_locked' }, 423);
  }

  const { data: from } = await adminClient
    .from('thread_organiser')
    .select('id, user_id, slug, display_name')
    .eq('id', thread.organiser_id)
    .maybeSingle();
  if (!from) return c.json({ error: 'this thread has no organiser to hand over from' }, 409);

  if (door === 'organiser') {
    // Only the organiser hands their own thread over.
    if (from.user_id !== ctx.userId) return c.json({ error: 'only the thread’s organiser can hand it over' }, 403);
  } else {
    // THE SECOND DOOR: a workspace admin, and only for an organiser who has
    // LEFT this workspace. Not "is unresponsive" — a door that opens on a
    // judgement gets used on somebody who was on holiday.
    const { data: wm } = await adminClient
      .from('workspace_member')
      .select('workspace_role')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (wm?.workspace_role !== 'admin' && wm?.workspace_role !== 'super_admin') {
      return c.json({ error: 'only a workspace admin can hand over a departed organiser’s thread' }, 403);
    }
    if (from.user_id && (await isWorkspaceMember(ctx.workspaceId, from.user_id as string))) {
      return c.json(
        { error: 'the organiser is still in this workspace — they hand it over themselves', code: 'organiser_still_here' },
        409,
      );
    }
    if (!body.data.reason) return c.json({ error: 'say why — the new organiser sees it' }, 400);
  }

  if (body.data.to_user_id === from.user_id) return c.json({ error: 'that is already the organiser' }, 400);
  if (!(await isWorkspaceMember(ctx.workspaceId, body.data.to_user_id))) return c.json({ error: 'not found' }, 404);

  let to = await organiserOf(body.data.to_user_id);
  if (!to) {
    const created = await provisionOrganiser(body.data.to_user_id, ctx.workspaceId);
    if (!created.ok) {
      return c.json(
        created.reason === 'elsewhere'
          ? { error: 'That person already has an organiser page in a different workspace.', code: 'organiser_elsewhere' }
          : { error: 'could not prepare their organiser profile' },
        created.reason === 'elsewhere' ? 409 : 500,
      );
    }
    to = await organiserOf(body.data.to_user_id);
    if (!to) return c.json({ error: 'could not prepare their organiser profile' }, 500);
  }

  const expires = new Date(Date.now() + HANDOVER_DAYS * 86_400_000);
  const { data: row, error } = await adminClient
    .from('thread_organiser_handover')
    .insert({
      workspace_id: ctx.workspaceId,
      thread_id: threadId,
      from_organiser_id: from.id,
      to_organiser_id: to.id,
      proposed_by_user_id: ctx.userId,
      door,
      reason: body.data.reason || null,
      // Sjoerd, 2026-10-16: on by default for the organiser door, and can be
      // unticked; off on the second door — that organiser has left.
      keep_as_host: body.data.keep_as_host ?? door === 'organiser',
      expires_at: expires.toISOString(),
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') return c.json({ error: 'a handover of this thread is already pending', code: 'handover_pending' }, 409);
    console.error('[thread/handover] propose failed', error);
    return c.json({ error: error.message }, 500);
  }

  const paymentProblem = await paymentProblemFor(threadId, body.data.to_user_id);
  const title = await threadTitle(threadId);
  const toContact = await userContact(to.user_id);
  const fromName = from.display_name ?? 'The organiser';
  await mail(
    ctx.workspaceId,
    toContact.email,
    `${door === 'organiser' ? fromName : 'A workspace admin'} would like you to take over “${title}”`,
    [
      door === 'organiser'
        ? `${fromName} would like to hand “${title}” over to you.`
        : `${fromName} has left the workspace, and an admin would like you to take over “${title}”.\n\nWhy: ${body.data.reason}`,
      '',
      'What moves to you: the thread, its public page and its address, new sign-ups and the money from them, and its scheduled messages. What stays with them: past sales, invoices and refunds of those.',
      paymentProblem ? `\nBefore you can accept: ${paymentProblem}` : '',
      `\nAccept or decline in Thread before ${expires.toUTCString()}: ${threadUrl()}/threads`,
    ].join('\n'),
  );

  return c.json({ handover: row, payment_problem: paymentProblem }, 201);
});

// ---------------------------------------------------------------------------
// List — mine, incoming and outgoing
// ---------------------------------------------------------------------------
threadHandoverRoutes.get('/handovers', async (c) => {
  const ctx = c.get('ctx');
  const me = await organiserOf(ctx.userId);
  const ors = [`proposed_by_user_id.eq.${ctx.userId}`];
  if (me) ors.push(`to_organiser_id.eq.${me.id}`, `from_organiser_id.eq.${me.id}`);
  // ctx.userId and the organiser id are uuids the server resolved, never
  // request text, so this .or() carries no injection (design note
  // postgrest-or-injection).
  const { data, error } = await adminClient
    .from('thread_organiser_handover')
    .select(
      '*, thread:thread_id (id, slug, program:program_id (title)), from:from_organiser_id (display_name, user:user_id (full_name, email)), to:to_organiser_id (display_name, user_id, user:user_id (full_name, email))',
    )
    .eq('workspace_id', ctx.workspaceId)
    .or(ors.join(','))
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return c.json({ error: error.message }, 500);
  const now = new Date();
  const items = (data ?? []).map((h) => {
    const row = h as HandoverRow & { to?: unknown; from?: unknown };
    const to = one(row.to) as { user_id?: string } | null;
    return {
      ...h,
      status: effectiveStatus(row, now),
      incoming: to?.user_id === ctx.userId,
      // Additive (2026-10-16): who, as a person reads it. An organiser row
      // can have no display name (provisioned for somebody who never set
      // one) — the banner then said "Handover to —", seen on staging.
      from_name: personName(row.from),
      to_name: personName(row.to),
    };
  });
  return c.json({ items });
});

async function loadHandover(id: string, workspaceId: string): Promise<HandoverRow | null> {
  const { data } = await adminClient
    .from('thread_organiser_handover')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return (data as HandoverRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------
threadHandoverRoutes.post('/handovers/:id/accept', async (c) => {
  const ctx = c.get('ctx');
  const h = await loadHandover(c.req.param('id'), ctx.workspaceId);
  if (!h) return c.json({ error: 'not found' }, 404);
  const status = effectiveStatus(h);
  if (status !== 'pending') return c.json({ error: `this request is ${status}`, code: `handover_${status}` }, 409);

  const { data: to } = await adminClient.from('thread_organiser').select('user_id').eq('id', h.to_organiser_id).maybeSingle();
  if (to?.user_id !== ctx.userId) return c.json({ error: 'only the proposed organiser can accept' }, 403);
  if (await threadLocked(h.thread_id)) {
    return c.json({ error: 'this thread is locked. Unlock it in Settings to make changes.', code: 'thread_locked' }, 423);
  }

  // (7) A paid, live thread whose new organiser cannot take the money is not
  // accepted until they can.
  const problem = await paymentProblemFor(h.thread_id, ctx.userId);
  if (problem) return c.json({ error: problem, code: 'payments_not_ready' }, 409);

  // BEFORE the switch: the account this thread's card sales are taken on
  // now, to stamp past rows that do not record their own (point 2).
  const { data: t } = await adminClient
    .from('thread_thread')
    .select('workspace_id, team_id, payment_destination, organiser:organiser_id (user_id)')
    .eq('id', h.thread_id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!t) return c.json({ error: 'not found' }, 404);
  const org = (Array.isArray(t.organiser) ? t.organiser[0] : t.organiser) as { user_id?: string | null } | null;
  const oldAccount = await threadDestinationAccount({
    workspace_id: t.workspace_id as string,
    team_id: (t.team_id as string | null) ?? null,
    payment_destination: (t.payment_destination as string | null) ?? null,
    organiser_user_id: org?.user_id ?? null,
  }).catch(() => null);
  const roomBefore = await threadRoom(h.thread_id);

  const { data: result, error } = await adminClient.rpc('accept_thread_handover', {
    p_handover_id: h.id,
    p_acting_user: ctx.userId,
    p_old_account: oldAccount,
  });
  if (error) {
    // A moved organiser is refused inside the function (a RAISE rolls back
    // any update there), so the cancellation is recorded here.
    if (/organiser changed/.test(error.message)) {
      await adminClient
        .from('thread_organiser_handover')
        .update({ status: 'cancelled', decided_at: new Date().toISOString() })
        .eq('id', h.id)
        .eq('status', 'pending');
    }
    const code = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 409;
    return c.json({ error: error.message }, code);
  }

  // (3) The room: with no main facilitator, the meeting account was the old
  // organiser and is now the new one — move future personal-room sessions,
  // exactly as removing the main facilitator does (thread.ts, members DELETE).
  try {
    const after = await threadRoom(h.thread_id);
    if (roomBefore.url !== after.url) {
      await propagateRoom({
        threadId: h.thread_id,
        oldUrl: roomBefore.url,
        newUrl: after.url,
        reason: 'The thread has a new organiser',
        owners: [null],
        newAccountUserId: after.account.userId,
        actorUserId: ctx.userId,
      });
    }
  } catch (e) {
    console.error('[thread/handover] room propagation failed (non-fatal)', { handover: h.id, error: e });
  }

  const title = await threadTitle(h.thread_id);
  const r = (result ?? {}) as { from_user_id?: string | null; to_user_id?: string | null };
  const newName = (await userContact(ctx.userId)).name ?? 'The new organiser';
  const proposer = await userContact(h.proposed_by_user_id);
  await mail(ctx.workspaceId, proposer.email, `${newName} has taken over “${title}”`, `${newName} accepted: “${title}” is now theirs. ${h.keep_as_host && h.door === 'organiser' ? 'You stay on it as a host.' : ''}`.trim());
  if (h.door === 'admin_departed' && r.from_user_id && r.from_user_id !== h.proposed_by_user_id) {
    const departed = await userContact(r.from_user_id);
    await mail(ctx.workspaceId, departed.email, `“${title}” has a new organiser`, `${newName} has taken over “${title}”. Your past sales and invoices from it stay yours.`);
  }

  return c.json({ ok: true, result });
});

// ---------------------------------------------------------------------------
// Decline (the proposed organiser) and cancel (the proposer)
// ---------------------------------------------------------------------------
threadHandoverRoutes.post('/handovers/:id/decline', async (c) => {
  const ctx = c.get('ctx');
  const h = await loadHandover(c.req.param('id'), ctx.workspaceId);
  if (!h) return c.json({ error: 'not found' }, 404);
  const { data: to } = await adminClient.from('thread_organiser').select('user_id').eq('id', h.to_organiser_id).maybeSingle();
  if (to?.user_id !== ctx.userId) return c.json({ error: 'only the proposed organiser can decline' }, 403);
  const status = effectiveStatus(h);
  if (status !== 'pending') return c.json({ error: `this request is ${status}` }, 409);
  const { error } = await adminClient
    .from('thread_organiser_handover')
    .update({ status: 'declined', decided_at: new Date().toISOString(), decided_by_user_id: ctx.userId })
    .eq('id', h.id)
    .eq('status', 'pending');
  if (error) return c.json({ error: error.message }, 500);
  const proposer = await userContact(h.proposed_by_user_id);
  const title = await threadTitle(h.thread_id);
  await mail(ctx.workspaceId, proposer.email, `Handover of “${title}” declined`, `The handover of “${title}” was declined. Nothing changed.`);
  return c.json({ ok: true });
});

threadHandoverRoutes.post('/handovers/:id/cancel', async (c) => {
  const ctx = c.get('ctx');
  const h = await loadHandover(c.req.param('id'), ctx.workspaceId);
  if (!h) return c.json({ error: 'not found' }, 404);
  if (h.proposed_by_user_id !== ctx.userId) return c.json({ error: 'only who proposed it can cancel it' }, 403);
  const status = effectiveStatus(h);
  if (status !== 'pending') return c.json({ error: `this request is ${status}` }, 409);
  const { error } = await adminClient
    .from('thread_organiser_handover')
    .update({ status: 'cancelled', decided_at: new Date().toISOString(), decided_by_user_id: ctx.userId })
    .eq('id', h.id)
    .eq('status', 'pending');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
