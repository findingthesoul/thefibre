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

import { randomUUID } from 'node:crypto';
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
  /** Rows proposed together (handover v2, a departed organiser's threads). */
  batch_id: string | null;
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

/** The new organiser's storefront, made for them if they have none yet. */
async function ensureOrganiser(
  userId: string,
  workspaceId: string,
): Promise<
  | { organiser: NonNullable<Awaited<ReturnType<typeof organiserOf>>> }
  | { error: { code: 409 | 500; body: Record<string, unknown> } }
> {
  let to = await organiserOf(userId);
  if (!to) {
    const created = await provisionOrganiser(userId, workspaceId);
    if (!created.ok) {
      return created.reason === 'elsewhere'
        ? { error: { code: 409, body: { error: 'That person already has an organiser page in a different workspace.', code: 'organiser_elsewhere' } } }
        : { error: { code: 500, body: { error: 'could not prepare their organiser profile' } } };
    }
    to = await organiserOf(userId);
    if (!to) return { error: { code: 500, body: { error: 'could not prepare their organiser profile' } } };
  }
  return { organiser: to };
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

  const ready = await ensureOrganiser(body.data.to_user_id, ctx.workspaceId);
  if ('error' in ready) return c.json(ready.error.body, ready.error.code);
  const to = ready.organiser;

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
/** A route's answer, so one accept can serve the single route and a batch. */
type Answer = { code: 200 | 403 | 404 | 409 | 423; body: Record<string, unknown> };
type Actor = { userId: string; workspaceId: string };

threadHandoverRoutes.post('/handovers/:id/accept', async (c) => {
  const ctx = c.get('ctx');
  const h = await loadHandover(c.req.param('id'), ctx.workspaceId);
  if (!h) return c.json({ error: 'not found' }, 404);
  const a = await acceptOne(h, ctx);
  return c.json(a.body, a.code);
});

/** THE accept. The single route and a batch both call this, so there is one
 *  accept path; a batch only skips the per-thread mail (`mail: false`) and
 *  sends one summary instead. */
async function acceptOne(h: HandoverRow, ctx: Actor, opts: { mail?: boolean } = {}): Promise<Answer> {
  const status = effectiveStatus(h);
  if (status !== 'pending') return { code: 409, body: { error: `this request is ${status}`, code: `handover_${status}` } };

  const { data: to } = await adminClient.from('thread_organiser').select('user_id').eq('id', h.to_organiser_id).maybeSingle();
  if (to?.user_id !== ctx.userId) return { code: 403, body: { error: 'only the proposed organiser can accept' } };
  if (await threadLocked(h.thread_id)) {
    return { code: 423, body: { error: 'this thread is locked. Unlock it in Settings to make changes.', code: 'thread_locked' } };
  }

  // (7) A paid, live thread whose new organiser cannot take the money is not
  // accepted until they can.
  const problem = await paymentProblemFor(h.thread_id, ctx.userId);
  if (problem) return { code: 409, body: { error: problem, code: 'payments_not_ready' } };

  // BEFORE the switch: the account this thread's card sales are taken on
  // now, to stamp past rows that do not record their own (point 2).
  const { data: t } = await adminClient
    .from('thread_thread')
    .select('workspace_id, team_id, payment_destination, organiser:organiser_id (user_id)')
    .eq('id', h.thread_id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!t) return { code: 404, body: { error: 'not found' } };
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
    return { code, body: { error: error.message } };
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

  if (opts.mail !== false) {
    const title = await threadTitle(h.thread_id);
    const r = (result ?? {}) as { from_user_id?: string | null; to_user_id?: string | null };
    const newName = (await userContact(ctx.userId)).name ?? 'The new organiser';
    const proposer = await userContact(h.proposed_by_user_id);
    await mail(ctx.workspaceId, proposer.email, `${newName} has taken over “${title}”`, `${newName} accepted: “${title}” is now theirs. ${h.keep_as_host && h.door === 'organiser' ? 'You stay on it as a host.' : ''}`.trim());
    if (h.door === 'admin_departed' && r.from_user_id && r.from_user_id !== h.proposed_by_user_id) {
      const departed = await userContact(r.from_user_id);
      await mail(ctx.workspaceId, departed.email, `“${title}” has a new organiser`, `${newName} has taken over “${title}”. Your past sales and invoices from it stay yours.`);
    }
  }

  return { code: 200, body: { ok: true, result } };
}

// ---------------------------------------------------------------------------
// Decline (the proposed organiser) and cancel (the proposer)
// ---------------------------------------------------------------------------
threadHandoverRoutes.post('/handovers/:id/decline', async (c) => {
  const ctx = c.get('ctx');
  const h = await loadHandover(c.req.param('id'), ctx.workspaceId);
  if (!h) return c.json({ error: 'not found' }, 404);
  const a = await declineOne(h, ctx);
  return c.json(a.body, a.code);
});

/** THE decline, for the single route and a batch (as acceptOne). */
async function declineOne(h: HandoverRow, ctx: Actor, opts: { mail?: boolean } = {}): Promise<{ code: 200 | 403 | 409 | 500; body: Record<string, unknown> }> {
  const { data: to } = await adminClient.from('thread_organiser').select('user_id').eq('id', h.to_organiser_id).maybeSingle();
  if (to?.user_id !== ctx.userId) return { code: 403, body: { error: 'only the proposed organiser can decline' } };
  const status = effectiveStatus(h);
  if (status !== 'pending') return { code: 409, body: { error: `this request is ${status}` } };
  const { error } = await adminClient
    .from('thread_organiser_handover')
    .update({ status: 'declined', decided_at: new Date().toISOString(), decided_by_user_id: ctx.userId })
    .eq('id', h.id)
    .eq('status', 'pending');
  if (error) return { code: 500, body: { error: error.message } };
  if (opts.mail !== false) {
    const proposer = await userContact(h.proposed_by_user_id);
    const title = await threadTitle(h.thread_id);
    await mail(ctx.workspaceId, proposer.email, `Handover of “${title}” declined`, `The handover of “${title}” was declined. Nothing changed.`);
  }
  return { code: 200, body: { ok: true } };
}

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

// ---------------------------------------------------------------------------
// Handover v2: ALL the threads of an organiser who has left, in one request
// (coordinator, plan approved 2026-10-16). Admin door only.
//
//   GET  /thread/handovers/departed                         who has left and still owns threads
//   GET  /thread/handovers/departed/:organiserId?to=<user>  their threads, each with v1's checks
//   POST /thread/handovers/batch                            propose: one row per eligible thread
//   POST /thread/handovers/batch/:batchId/accept|decline    the new organiser, for every open row
//
// A batch is N ordinary handover rows sharing a batch_id. Each is decided on
// its own (a paid thread can wait for the new organiser's payments while the
// free ones move today), and each is accepted by acceptOne — the one accept
// path. A thread that fails a HARD check (locked, a request already open) is
// left out with its reason; payment readiness is a flag on the thread, not a
// block, exactly as in v1.
// ---------------------------------------------------------------------------

async function isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
  const { data: wm } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return wm?.workspace_role === 'admin' || wm?.workspace_role === 'super_admin';
}

type DepartedOrganiser = { id: string; user_id: string | null; name: string | null };

/** The organiser, when they own threads in this workspace and are no longer
 *  a member of it. 'still_here' when they are — they hand over themselves. */
async function departedOrganiser(
  workspaceId: string,
  organiserId: string,
): Promise<DepartedOrganiser | 'not_found' | 'still_here'> {
  const { data: owns } = await adminClient
    .from('thread_thread')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('organiser_id', organiserId)
    .limit(1);
  if (!owns?.length) return 'not_found';
  const { data: org } = await adminClient
    .from('thread_organiser')
    .select('id, user_id, display_name, user:user_id (full_name, email)')
    .eq('id', organiserId)
    .maybeSingle();
  if (!org) return 'not_found';
  if (org.user_id && (await isWorkspaceMember(workspaceId, org.user_id as string))) return 'still_here';
  return { id: org.id as string, user_id: (org.user_id as string | null) ?? null, name: personName(org) };
}

export type BatchCandidate = {
  thread_id: string;
  title: string;
  status: string | null;
  starts_on: string | null;
  ends_on: string | null;
  /** Upcoming or running: ticked in the admin's list. Past ones are listed, unticked. */
  suggested: boolean;
  /** A hard check failed: this thread cannot go in the request. */
  excluded: { code: 'thread_locked' | 'handover_pending'; reason: string } | null;
  /** Judged as the NEW organiser; the thread goes in, and only its accept waits. */
  payment_problem: string | null;
};

/** Upcoming or running: a draft or active thread that has not ended before today. */
export function suggestedForBatch(p: { status: string | null; ends_on: string | null }, today: string): boolean {
  if (p.status !== 'draft' && p.status !== 'active') return false;
  return !p.ends_on || p.ends_on >= today;
}

/** The departed organiser's threads (archived ones left out), each with the
 *  same checks as a single handover. `toUserId` null = no payment check yet. */
async function batchCandidates(
  workspaceId: string,
  organiserId: string,
  toUserId: string | null,
  now = new Date(),
): Promise<BatchCandidate[]> {
  const { data: rows } = await adminClient
    .from('thread_thread')
    .select('id, slug, locked_at, program:program_id (title, status, starts_on, ends_on)')
    .eq('workspace_id', workspaceId)
    .eq('organiser_id', organiserId);
  type Prog = { title?: string; status?: string; starts_on?: string | null; ends_on?: string | null };
  const threads = (rows ?? [])
    .map((r) => ({ r, p: one(r.program as Prog | Prog[] | null) }))
    .filter(({ p }) => p?.status !== 'archived');
  if (!threads.length) return [];

  const ids = threads.map(({ r }) => r.id as string);
  const { data: open } = await adminClient
    .from('thread_organiser_handover')
    .select('thread_id, status, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .in('thread_id', ids);
  // A stored 'pending' past its expiry IS expired (effectiveStatus); only a
  // live one blocks. The expired row is closed when the batch is proposed.
  const pending = new Set(
    (open ?? [])
      .filter((h) => effectiveStatus(h as Pick<HandoverRow, 'status' | 'expires_at'>, now) === 'pending')
      .map((h) => h.thread_id as string),
  );
  const today = now.toISOString().slice(0, 10);

  const out: BatchCandidate[] = [];
  for (const { r, p } of threads) {
    const id = r.id as string;
    const excluded: BatchCandidate['excluded'] = r.locked_at
      ? { code: 'thread_locked', reason: 'This thread is locked. Unlock it in Settings first.' }
      : pending.has(id)
        ? { code: 'handover_pending', reason: 'A handover of this thread is already pending.' }
        : null;
    out.push({
      thread_id: id,
      title: p?.title ?? (r.slug as string),
      status: p?.status ?? null,
      starts_on: p?.starts_on ?? null,
      ends_on: p?.ends_on ?? null,
      suggested: !excluded && suggestedForBatch({ status: p?.status ?? null, ends_on: p?.ends_on ?? null }, today),
      excluded,
      payment_problem: toUserId && !excluded ? await paymentProblemFor(id, toUserId) : null,
    });
  }
  // Upcoming first, then by start.
  return out.sort((a, b) => Number(b.suggested) - Number(a.suggested) || (a.starts_on ?? '').localeCompare(b.starts_on ?? ''));
}

threadHandoverRoutes.get('/handovers/departed', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx.workspaceId, ctx.userId))) return c.json({ error: 'workspace admins only' }, 403);
  const { data: rows, error } = await adminClient
    .from('thread_thread')
    .select('organiser_id, program:program_id (status)')
    .eq('workspace_id', ctx.workspaceId)
    .not('organiser_id', 'is', null);
  if (error) return c.json({ error: error.message }, 500);
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    if (one(r.program as { status?: string } | { status?: string }[] | null)?.status === 'archived') continue;
    counts.set(r.organiser_id as string, (counts.get(r.organiser_id as string) ?? 0) + 1);
  }
  if (!counts.size) return c.json({ items: [] });
  const { data: orgs } = await adminClient
    .from('thread_organiser')
    .select('id, user_id, display_name, user:user_id (full_name, email)')
    .in('id', [...counts.keys()]);
  const userIds = (orgs ?? []).map((o) => o.user_id as string | null).filter((u): u is string => !!u);
  const { data: members } = userIds.length
    ? await adminClient.from('workspace_member').select('user_id').eq('workspace_id', ctx.workspaceId).in('user_id', userIds)
    : { data: [] as { user_id: string }[] };
  const here = new Set((members ?? []).map((m) => m.user_id as string));
  const items = (orgs ?? [])
    .filter((o) => !o.user_id || !here.has(o.user_id as string))
    .map((o) => ({ organiser_id: o.id as string, name: personName(o), thread_count: counts.get(o.id as string) ?? 0 }))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  return c.json({ items });
});

threadHandoverRoutes.get('/handovers/departed/:organiserId', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx.workspaceId, ctx.userId))) return c.json({ error: 'workspace admins only' }, 403);
  const organiserId = c.req.param('organiserId');
  if (!z.string().uuid().safeParse(organiserId).success) return c.json({ error: 'not found' }, 404);
  const to = c.req.query('to') || null;
  if (to && !z.string().uuid().safeParse(to).success) return c.json({ error: 'to must be a user id' }, 400);
  const from = await departedOrganiser(ctx.workspaceId, organiserId);
  if (from === 'not_found') return c.json({ error: 'not found' }, 404);
  if (from === 'still_here') {
    return c.json({ error: 'the organiser is still in this workspace — they hand it over themselves', code: 'organiser_still_here' }, 409);
  }
  if (to && to === from.user_id) return c.json({ error: 'that is already the organiser' }, 400);
  if (to && !(await isWorkspaceMember(ctx.workspaceId, to))) return c.json({ error: 'not found' }, 404);
  return c.json({ organiser: { id: from.id, name: from.name }, items: await batchCandidates(ctx.workspaceId, from.id, to) });
});

const ProposeBatch = z.object({
  from_organiser_id: z.string().uuid(),
  to_user_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
  threads: z
    .array(z.object({ id: z.string().uuid(), keep_as_host: z.boolean().optional() }))
    .min(1)
    .max(200),
});

threadHandoverRoutes.post('/handovers/batch', async (c) => {
  const ctx = c.get('ctx');
  const body = ProposeBatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  if (!(await isWorkspaceAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'only a workspace admin can hand over a departed organiser’s threads' }, 403);
  }
  const from = await departedOrganiser(ctx.workspaceId, body.data.from_organiser_id);
  if (from === 'not_found') return c.json({ error: 'not found' }, 404);
  if (from === 'still_here') {
    return c.json({ error: 'the organiser is still in this workspace — they hand it over themselves', code: 'organiser_still_here' }, 409);
  }
  if (body.data.to_user_id === from.user_id) return c.json({ error: 'that is already the organiser' }, 400);
  if (!(await isWorkspaceMember(ctx.workspaceId, body.data.to_user_id))) return c.json({ error: 'not found' }, 404);
  const ready = await ensureOrganiser(body.data.to_user_id, ctx.workspaceId);
  if ('error' in ready) return c.json(ready.error.body, ready.error.code);
  const to = ready.organiser;

  // The checks again, server-side: the admin's list may be minutes old.
  const now = new Date();
  const byId = new Map((await batchCandidates(ctx.workspaceId, from.id, to.user_id, now)).map((k) => [k.thread_id, k]));
  const excluded: { thread_id: string; title: string | null; code: string; reason: string }[] = [];
  const eligible: { k: BatchCandidate; keep: boolean }[] = [];
  for (const t of body.data.threads) {
    const k = byId.get(t.id);
    if (!k) excluded.push({ thread_id: t.id, title: null, code: 'not_this_organisers', reason: 'Not one of this organiser’s threads.' });
    else if (k.excluded) excluded.push({ thread_id: t.id, title: k.title, code: k.excluded.code, reason: k.excluded.reason });
    // Off by default on this door: the organiser has LEFT, so staying on as
    // a host is the exception (Sjoerd's "on by default" was for an organiser
    // who hands over and stays). The admin can tick it per thread.
    else eligible.push({ k, keep: t.keep_as_host ?? false });
  }
  if (!eligible.length) return c.json({ error: 'none of these threads can be handed over', code: 'nothing_eligible', excluded }, 409);

  // A stored 'pending' past its expiry is expired; close it, so the
  // one-pending-per-thread index does not refuse the new row for it.
  await adminClient
    .from('thread_organiser_handover')
    .update({ status: 'expired' })
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'pending')
    .lte('expires_at', now.toISOString())
    .in('thread_id', eligible.map((e) => e.k.thread_id));

  const batchId = randomUUID();
  const expires = new Date(now.getTime() + HANDOVER_DAYS * 86_400_000);
  const handovers: HandoverRow[] = [];
  for (const { k, keep } of eligible) {
    // One row at a time: a request opened on one thread since the check
    // leaves THAT thread out, not the whole batch.
    const { data: row, error } = await adminClient
      .from('thread_organiser_handover')
      .insert({
        workspace_id: ctx.workspaceId,
        thread_id: k.thread_id,
        from_organiser_id: from.id,
        to_organiser_id: to.id,
        proposed_by_user_id: ctx.userId,
        door: 'admin_departed',
        reason: body.data.reason,
        keep_as_host: keep,
        expires_at: expires.toISOString(),
        batch_id: batchId,
      })
      .select('*')
      .single();
    if (error?.code === '23505') {
      excluded.push({ thread_id: k.thread_id, title: k.title, code: 'handover_pending', reason: 'A handover of this thread is already pending.' });
      continue;
    }
    if (error) {
      console.error('[thread/handover] batch insert failed', { batch: batchId, thread: k.thread_id, error });
      excluded.push({ thread_id: k.thread_id, title: k.title, code: 'error', reason: error.message });
      continue;
    }
    handovers.push(row as HandoverRow);
  }
  if (!handovers.length) return c.json({ error: 'none of these threads can be handed over', code: 'nothing_eligible', excluded }, 409);

  const inBatch = eligible.filter((e) => handovers.some((h) => h.thread_id === e.k.thread_id)).map((e) => e.k);
  const toContact = await userContact(to.user_id);
  const fromName = from.name ?? 'An organiser';
  await mail(
    ctx.workspaceId,
    toContact.email,
    inBatch.length === 1
      ? `A workspace admin would like you to take over “${inBatch[0]!.title}”`
      : `A workspace admin would like you to take over ${inBatch.length} threads`,
    [
      `${fromName} has left the workspace, and an admin would like you to take over ${inBatch.length === 1 ? 'this thread' : 'these threads'}:`,
      '',
      ...inBatch.map((k) => `• ${k.title}${k.payment_problem ? ` (before you can accept: ${k.payment_problem})` : ''}`),
      '',
      `Why: ${body.data.reason}`,
      '',
      'What moves to you: each thread, its public page and its address, new sign-ups and the money from them, and its scheduled messages. What stays with them: past sales, invoices and refunds of those.',
      `\nAccept or decline each one, or all at once, in Thread before ${expires.toUTCString()}: ${threadUrl()}/threads`,
    ].join('\n'),
  );

  return c.json(
    {
      batch_id: batchId,
      handovers,
      excluded,
      payment_problems: Object.fromEntries(inBatch.filter((k) => k.payment_problem).map((k) => [k.thread_id, k.payment_problem])),
    },
    201,
  );
});

/** Every still-open row of a batch, answered one by one through the single
 *  path; one summary mail instead of one per thread. */
async function answerBatch(ctx: Actor, batchId: string, kind: 'accept' | 'decline'): Promise<{ code: 200 | 403 | 404; body: Record<string, unknown> }> {
  if (!z.string().uuid().safeParse(batchId).success) return { code: 404, body: { error: 'not found' } };
  const { data } = await adminClient
    .from('thread_organiser_handover')
    .select('*')
    .eq('batch_id', batchId)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: true });
  const rows = (data as HandoverRow[] | null) ?? [];
  if (!rows.length) return { code: 404, body: { error: 'not found' } };
  const first = rows[0]!;
  const { data: to } = await adminClient.from('thread_organiser').select('user_id').eq('id', first.to_organiser_id).maybeSingle();
  if (to?.user_id !== ctx.userId) return { code: 403, body: { error: `only the proposed organiser can ${kind}` } };

  const results: { handover_id: string; thread_id: string; title: string; ok: boolean; error?: string; code?: string }[] = [];
  for (const h of rows.filter((r) => effectiveStatus(r) === 'pending')) {
    const a = kind === 'accept' ? await acceptOne(h, ctx, { mail: false }) : await declineOne(h, ctx, { mail: false });
    const title = await threadTitle(h.thread_id);
    results.push(
      a.code === 200
        ? { handover_id: h.id, thread_id: h.thread_id, title, ok: true }
        : {
            handover_id: h.id,
            thread_id: h.thread_id,
            title,
            ok: false,
            error: String(a.body.error ?? ''),
            ...(a.body.code ? { code: String(a.body.code) } : {}),
          },
    );
  }

  const done = results.filter((r) => r.ok);
  const waiting = results.filter((r) => !r.ok);
  if (done.length) {
    const list = done.map((r) => `• ${r.title}`).join('\n');
    const what = done.length === 1 ? `“${done[0]!.title}”` : `${done.length} threads`;
    const proposer = await userContact(first.proposed_by_user_id);
    if (kind === 'accept') {
      const newName = (await userContact(ctx.userId)).name ?? 'The new organiser';
      const still = waiting.length ? `\n\nStill waiting:\n${waiting.map((r) => `• ${r.title}: ${r.error}`).join('\n')}` : '';
      await mail(ctx.workspaceId, proposer.email, `${newName} has taken over ${what}`, `${newName} accepted:\n${list}${still}`);
      const { data: fromOrg } = await adminClient.from('thread_organiser').select('user_id').eq('id', first.from_organiser_id).maybeSingle();
      const fromUser = (fromOrg?.user_id as string | null) ?? null;
      if (fromUser && fromUser !== first.proposed_by_user_id) {
        const departed = await userContact(fromUser);
        await mail(
          ctx.workspaceId,
          departed.email,
          done.length === 1 ? `“${done[0]!.title}” has a new organiser` : `${done.length} of your threads have a new organiser`,
          `${newName} has taken over:\n${list}\n\nYour past sales and invoices from them stay yours.`,
        );
      }
    } else {
      await mail(ctx.workspaceId, proposer.email, `Handover of ${what} declined`, `The handover was declined. Nothing changed for:\n${list}`);
    }
  }
  return { code: 200, body: { results, [kind === 'accept' ? 'accepted' : 'declined']: done.length, refused: waiting.length } };
}

threadHandoverRoutes.post('/handovers/batch/:batchId/accept', async (c) => {
  const a = await answerBatch(c.get('ctx'), c.req.param('batchId'), 'accept');
  return c.json(a.body, a.code);
});

threadHandoverRoutes.post('/handovers/batch/:batchId/decline', async (c) => {
  const a = await answerBatch(c.get('ctx'), c.req.param('batchId'), 'decline');
  return c.json(a.body, a.code);
});
