// CANCELLATION REQUESTS — a participant asks to cancel their place; the
// organiser decides (Sjoerd's 2iv, plan approved 2026-10-16).
//
//   participant (my.thread, verified email):
//     POST   /me/enrolments/:id/cancellation-request   { reason? }
//     DELETE /me/enrolments/:id/cancellation-request   — withdraw
//   organiser / admin / host (Thread):
//     GET    /thread/threads/:id/cancellation-requests
//     POST   /thread/cancellation-requests/:id/approve { refund }
//     POST   /thread/cancellation-requests/:id/reject  { note? }
//
// NOTHING HERE IS A SECOND COPY OF SOMETHING THAT EXISTS:
//   · approving DROPS the place through performDeclineEnrolment, the core of
//     POST /enrolments/:id/decline (dropped, the seat freed, a pending
//     Checkout expired);
//   · its refund is reimbursePurchase (lib/reimburse.ts), the core of
//     POST /purchases/:id/refund that the Invoices pages call;
//   · who may decide is loadEnrolmentForAction's answer (admin, the thread's
//     organiser, or a co-organising host) — the same as Decline.
//
// APPROVE CLAIMS FIRST. pending → approved is a conditional update; only the
// caller that got the row back drops the place and refunds, so a double
// click or two staff at once cannot refund twice. If the refund then fails,
// nothing is rolled back: the place stays dropped, `refund_error` says why,
// and the organiser uses Reimburse on the invoice. A dropped place and a
// manual refund can be put right; a double refund cannot.
//
// The rows hold a participant's own words, so they are never deleted here:
// withdrawing is a status, like every other ending.

import { Hono } from 'hono';
import { z } from 'zod';
import { INTL_LOCALES, toLocale } from '@thefibre/shared';
import { money } from '@thefibre/shared/money';
import { adminClient, userClient } from '../db.js';
import { participantEmailFromAuth } from '../lib/participant-auth.js';
import { personsForEmail } from '../lib/portal-agenda.js';
import { loadThreadDates } from '../lib/thread-dates.js';
import { threadHosts } from '../lib/main-facilitator.js';
import { reimbursePurchase, type ReimbursablePurchase } from '../lib/reimburse.js';
import { quoteForPlace } from '../lib/refund-quote.js';
import { sendEmail } from '../lib/email/client.js';
import { platformEmailLocale } from '../lib/email/platform-i18n.js';
import {
  cancellationApprovedEmail,
  cancellationRejectedEmail,
  cancellationRequestedEmail,
} from '../lib/email/thread-templates.js';
import { myThreadUrl } from '../lib/message-tokens.js';
import { workspaceSender } from '../lib/workspace-brand.js';
import { actorUserId } from '../middleware/app-context.js';
import {
  loadEnrolmentForAction,
  logEnrolmentActivity,
  performDeclineEnrolment,
  threadAppUrl,
} from './thread.js';

const one = <T>(v: unknown): T | null => (!v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T));

/** Places that may still ask: invited (awaiting approval), enrolled, active. */
export const REQUESTABLE_STATUSES = ['invited', 'enrolled', 'active'] as const;

/** Is the thread over? Its last key moment's end, else the end of its
 *  period (a bare date counts to the end of that day). Undated: never over.
 *  The same dates every card reads (thread dates slice 4). */
export function threadIsOver(
  dates: { event: { end: string } | null; period: { end: string | null } } | undefined,
  now: Date,
): boolean {
  const end = dates?.event?.end ?? dates?.period.end ?? null;
  if (!end) return false;
  const at = /^\d{4}-\d{2}-\d{2}$/.test(end) ? new Date(`${end}T23:59:59.999Z`) : new Date(end);
  return at.getTime() < now.getTime();
}

export type CancellationState = {
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  created_at: string;
  decision_note: string | null;
} | null;

/** The latest request per place, for the participant's own payload. */
export async function cancellationStateFor(enrolmentIds: string[]): Promise<Map<string, CancellationState>> {
  const out = new Map<string, CancellationState>();
  if (!enrolmentIds.length) return out;
  const { data, error } = await adminClient
    .from('thread_cancellation_request')
    .select('enrolment_id, status, created_at, decision_note')
    .in('enrolment_id', enrolmentIds)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`cancellation state: ${error.message}`);
  for (const r of data ?? []) {
    if (out.has(r.enrolment_id as string)) continue;
    out.set(r.enrolment_id as string, {
      status: r.status as NonNullable<CancellationState>['status'],
      created_at: r.created_at as string,
      // A rejection's note is for the participant; the others carry none.
      decision_note: r.status === 'rejected' ? ((r.decision_note as string | null) ?? null) : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The participant's side
// ---------------------------------------------------------------------------

type OwnPlace = {
  id: string;
  workspace_id: string;
  thread_id: string;
  person_id: string;
  enrolment_status: string | null;
  person_name: string;
  thread_title: string;
  thread_language: string | null;
  organiser_email: string | null;
};

/** The place, if it is this signed-in person's; null otherwise (a 404, so a
 *  stranger learns nothing about whether the id exists). */
async function ownPlace(email: string, enrolmentId: string): Promise<OwnPlace | null> {
  const persons = await personsForEmail(email);
  const personIds = new Set(persons.map((p) => p.id));
  if (!personIds.size) return null;
  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select(
      `id, workspace_id, thread_id, person_id,
       enrolment:enrolment_id (status),
       person:person_id (first_name, last_name, email),
       thread:thread_id (language, program:program_id (title), organiser:organiser_id (user:user_id (email)))`,
    )
    .eq('id', enrolmentId)
    .maybeSingle();
  if (!te || !personIds.has(te.person_id as string)) return null;
  const person = one<{ first_name: string | null; last_name: string | null; email: string | null }>(te.person);
  const thread = one<{ language: string | null; program: unknown; organiser: unknown }>(te.thread);
  const program = one<{ title: string }>(thread?.program);
  const organiser = one<{ user: unknown }>(thread?.organiser);
  return {
    id: te.id as string,
    workspace_id: te.workspace_id as string,
    thread_id: te.thread_id as string,
    person_id: te.person_id as string,
    enrolment_status: one<{ status: string | null }>(te.enrolment)?.status ?? null,
    person_name: [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.email || email,
    thread_title: program?.title ?? '',
    thread_language: thread?.language ?? null,
    organiser_email: one<{ email: string | null }>(organiser?.user)?.email ?? null,
  };
}

/** Why this place may not ask, or null when it may. */
export async function whyNotRequestable(place: Pick<OwnPlace, 'id' | 'thread_id' | 'enrolment_status'>, now: Date): Promise<string | null> {
  if (!REQUESTABLE_STATUSES.includes((place.enrolment_status ?? '') as (typeof REQUESTABLE_STATUSES)[number])) {
    return 'this place can no longer be cancelled';
  }
  const [{ data: cert }, dates] = await Promise.all([
    adminClient.from('thread_certificate').select('id').eq('thread_enrolment_id', place.id).limit(1),
    loadThreadDates([place.thread_id]),
  ]);
  if ((cert ?? []).length) return 'a certificate has been issued for this place';
  if (threadIsOver(dates.get(place.thread_id), now)) return 'this thread is over';
  return null;
}

const RequestBody = z.object({ reason: z.string().trim().max(2000).nullable().optional() });

export const cancellationMeRoutes = new Hono();

cancellationMeRoutes.post('/enrolments/:id/cancellation-request', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = RequestBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'reason is too long' }, 400);
  const place = await ownPlace(email, c.req.param('id'));
  if (!place) return c.json({ error: 'not found' }, 404);
  const why = await whyNotRequestable(place, new Date());
  if (why) return c.json({ error: why }, 409);

  const reason = body.data.reason?.trim() || null;
  const { data: row, error } = await adminClient
    .from('thread_cancellation_request')
    .insert({
      workspace_id: place.workspace_id,
      thread_id: place.thread_id,
      enrolment_id: place.id,
      person_id: place.person_id,
      reason,
    })
    .select('id, status, created_at')
    .single();
  if (error) {
    if (error.code === '23505') return c.json({ error: 'a request is already open for this place' }, 409);
    console.error('[cancellation] request insert failed', { message: error.message });
    return c.json({ error: 'could not record the request' }, 500);
  }
  await logEnrolmentActivity(place.workspace_id, place.person_id, 'cancellation_requested', `Cancellation requested: ${place.thread_title}`);

  // To the organiser and every host with an address, each in their language.
  // A failed mail must not undo the request: it is on the organiser's list.
  try {
    const hosts = await threadHosts(place.thread_id);
    const to = [...new Set([place.organiser_email, ...hosts.map((h) => h.email)].filter((e): e is string => !!e).map((e) => e.toLowerCase()))];
    const sender = await workspaceSender(place.workspace_id);
    for (const address of to) {
      const mail = cancellationRequestedEmail({
        threadTitle: place.thread_title,
        participantName: place.person_name,
        reason,
        url: `${threadAppUrl()}/threads/${place.thread_id}?registrations=1`,
        locale: await platformEmailLocale(address, place.thread_language),
      });
      await sendEmail({ to: address, ...mail, ...sender });
    }
  } catch (e) {
    console.error('[cancellation] request email failed', { message: (e as Error).message });
  }
  return c.json({ ok: true, cancellation_request: { status: row.status, created_at: row.created_at, decision_note: null } }, 201);
});

cancellationMeRoutes.delete('/enrolments/:id/cancellation-request', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const place = await ownPlace(email, c.req.param('id'));
  if (!place) return c.json({ error: 'not found' }, 404);
  const { data, error } = await adminClient
    .from('thread_cancellation_request')
    .update({ status: 'withdrawn', decided_at: new Date().toISOString() })
    .eq('enrolment_id', place.id)
    .eq('status', 'pending')
    .select('id');
  if (error) return c.json({ error: 'could not withdraw the request' }, 500);
  if (!(data ?? []).length) return c.json({ error: 'there is no open request to withdraw' }, 409);
  await logEnrolmentActivity(place.workspace_id, place.person_id, 'cancellation_withdrawn', `Cancellation withdrawn: ${place.thread_title}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// The organiser's side
// ---------------------------------------------------------------------------

export const cancellationStaffRoutes = new Hono();

type StaffRequest = {
  id: string;
  workspace_id: string;
  thread_id: string;
  enrolment_id: string;
  status: string;
};

/** The request, if the caller may decide on its place; the error otherwise. */
async function loadForDecision(
  c: { get: (k: 'ctx') => { jwt: string; userId: string; workspaceId: string } },
  requestId: string,
): Promise<{ req: StaffRequest; loaded: Exclude<Awaited<ReturnType<typeof loadEnrolmentForAction>>, null | 'forbidden'> } | { error: string; code: 403 | 404 }> {
  const ctx = c.get('ctx');
  const { data: req } = await adminClient
    .from('thread_cancellation_request')
    .select('id, workspace_id, thread_id, enrolment_id, status')
    .eq('id', requestId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!req) return { error: 'not found', code: 404 };
  const loaded = await loadEnrolmentForAction(ctx.jwt, req.enrolment_id as string, {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
  });
  if (!loaded) return { error: 'not found', code: 404 };
  if (loaded === 'forbidden') return { error: 'only the thread organiser (or an admin) can do that', code: 403 };
  return { req: req as StaffRequest, loaded };
}

/** The card payment behind a place, if there is one that could be refunded. */
async function cardPurchaseFor(workspaceId: string, enrolmentId: string) {
  const { data: app } = await adminClient.from('app').select('id').eq('slug', 'the-thread').single();
  const { data } = await adminClient
    .from('purchase')
    .select('id, item_ref, method, status, amount_cents, currency, stripe_payment_intent, stripe_account_id')
    .eq('workspace_id', workspaceId)
    .eq('app_id', app!.id)
    .eq('item_ref', enrolmentId)
    .maybeSingle();
  return data as (ReimbursablePurchase & { currency: string | null }) | null;
}

cancellationStaffRoutes.get('/threads/:id/cancellation-requests', async (c) => {
  const ctx = c.get('ctx');
  // On the caller's client: RLS scopes it to their workspace and to staff
  // with the Thread app, as it does the registrations themselves.
  const { data, error } = await userClient(ctx.jwt)
    .from('thread_cancellation_request')
    .select('id, enrolment_id, status, reason, decision_note, decided_at, refunded_cents, refund_error, created_at, person:person_id (first_name, last_name, email)')
    .eq('thread_id', c.req.param('id'))
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  const rows = (data ?? []) as Record<string, unknown>[];
  // What an approval could refund: the card payment behind each place.
  const { data: app } = await adminClient.from('app').select('id').eq('slug', 'the-thread').single();
  const enrolmentIds = [...new Set(rows.map((r) => r.enrolment_id as string))];
  const { data: purchases } = enrolmentIds.length
    ? await adminClient
        .from('purchase')
        .select('item_ref, method, status, amount_cents, currency')
        .eq('workspace_id', ctx.workspaceId)
        .eq('app_id', app!.id)
        .in('item_ref', enrolmentIds)
    : { data: [] };
  const paidByCard = new Map(
    (purchases ?? [])
      .filter((p) => p.method === 'stripe' && p.status === 'paid')
      .map((p) => [p.item_ref as string, { amount_cents: p.amount_cents as number, currency: (p.currency as string) ?? 'EUR' }]),
  );
  // What the refund RULE says for each request, counted at the request's own
  // date (C). Information only until partial refunds ship: the approve
  // action still refunds in full or not at all.
  const quotes = new Map(
    await Promise.all(
      rows.map(async (r) => [r.id as string, await quoteForPlace(r.enrolment_id as string, c.req.param('id'), new Date(r.created_at as string))] as const),
    ),
  );
  return c.json({
    items: rows.map((r) => {
      const p = one<{ first_name: string | null; last_name: string | null; email: string | null }>(r.person);
      return {
        id: r.id,
        enrolment_id: r.enrolment_id,
        status: r.status,
        reason: r.reason ?? null,
        decision_note: r.decision_note ?? null,
        decided_at: r.decided_at ?? null,
        refunded_cents: r.refunded_cents ?? null,
        refund_error: r.refund_error ?? null,
        created_at: r.created_at,
        person_name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.email || null,
        person_email: p?.email ?? null,
        // Null when there is no card payment to give back (an invoice place,
        // a free one, or one already refunded): the dialog offers no refund.
        refundable: paidByCard.get(r.enrolment_id as string) ?? null,
        // Additive (refund rules, slice 2): the rule's answer, or null when
        // nothing was paid. Shown as information; it does not set the amount.
        refund_quote: quotes.get(r.id as string) ?? null,
      };
    }),
  });
});

const ApproveBody = z.object({ refund: z.boolean().optional() });

cancellationStaffRoutes.post('/cancellation-requests/:id/approve', async (c) => {
  const ctx = c.get('ctx');
  const body = ApproveBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'invalid body' }, 400);
  const got = await loadForDecision(c as never, c.req.param('id'));
  if ('error' in got) return c.json({ error: got.error }, got.code);
  const { req, loaded } = got;

  // THE CLAIM. Only the caller that turns pending into approved goes on.
  const { data: claimed, error: claimErr } = await adminClient
    .from('thread_cancellation_request')
    .update({ status: 'approved', decided_by: actorUserId(ctx as never), decided_at: new Date().toISOString() })
    .eq('id', req.id)
    .eq('status', 'pending')
    .select('id');
  if (claimErr) return c.json({ error: claimErr.message }, 500);
  if (!(claimed ?? []).length) return c.json({ error: 'this request has already been decided' }, 409);

  const [declined, code] = await performDeclineEnrolment(loaded);
  if (code !== 200) {
    // The place could not be dropped: say so loudly and leave the record
    // approved — the organiser can decline the place by hand.
    console.error('[cancellation] drop failed after approval', { request: req.id, declined });
    await adminClient.from('thread_cancellation_request').update({ refund_error: 'the place could not be released' }).eq('id', req.id);
    return c.json({ error: 'approved, but the place could not be released — decline it by hand' }, 500);
  }

  let refundedCents: number | null = null;
  let refundError: string | null = null;
  if (body.data.refund) {
    const purchase = await cardPurchaseFor(req.workspace_id, req.enrolment_id);
    if (!purchase || purchase.method !== 'stripe' || purchase.status !== 'paid') {
      refundError = 'there is no card payment to refund';
    } else {
      const done = await reimbursePurchase(purchase, 'the-thread');
      if ('error' in done) refundError = done.error;
      else refundedCents = done.already ? null : done.refunded_cents;
    }
    await adminClient
      .from('thread_cancellation_request')
      .update({ refunded_cents: refundedCents, refund_error: refundError })
      .eq('id', req.id);
  }

  await logEnrolmentActivity(loaded.thread.workspace_id, loaded.person.id, 'cancellation_approved', `Cancellation approved: ${loaded.program.title}`);

  if (loaded.person.email) {
    try {
      const locale = await platformEmailLocale(loaded.person.email, loaded.thread.language ?? null);
      const purchase = refundedCents ? await cardPurchaseFor(req.workspace_id, req.enrolment_id) : null;
      const mail = cancellationApprovedEmail({
        threadTitle: loaded.program.title,
        organiserName: loaded.organiserName,
        refundedLine: refundedCents ? money(refundedCents, purchase?.currency ?? 'EUR', INTL_LOCALES[toLocale(locale)]) : null,
        portalUrl: myThreadUrl(),
        locale,
      });
      await sendEmail({ to: loaded.person.email, ...mail, ...(await workspaceSender(loaded.thread.workspace_id)) });
    } catch (e) {
      console.error('[cancellation] approval email failed', { message: (e as Error).message });
    }
  }
  return c.json({ ok: true, refunded_cents: refundedCents, refund_error: refundError });
});

const RejectBody = z.object({ note: z.string().trim().max(2000).nullable().optional() });

cancellationStaffRoutes.post('/cancellation-requests/:id/reject', async (c) => {
  const ctx = c.get('ctx');
  const body = RejectBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'the note is too long' }, 400);
  const got = await loadForDecision(c as never, c.req.param('id'));
  if ('error' in got) return c.json({ error: got.error }, got.code);
  const { req, loaded } = got;
  const note = body.data.note?.trim() || null;

  const { data: claimed, error } = await adminClient
    .from('thread_cancellation_request')
    .update({ status: 'rejected', decision_note: note, decided_by: actorUserId(ctx as never), decided_at: new Date().toISOString() })
    .eq('id', req.id)
    .eq('status', 'pending')
    .select('id');
  if (error) return c.json({ error: error.message }, 500);
  if (!(claimed ?? []).length) return c.json({ error: 'this request has already been decided' }, 409);

  await logEnrolmentActivity(loaded.thread.workspace_id, loaded.person.id, 'cancellation_rejected', `Cancellation declined: ${loaded.program.title}`);
  if (loaded.person.email) {
    try {
      const mail = cancellationRejectedEmail({
        threadTitle: loaded.program.title,
        organiserName: loaded.organiserName,
        note,
        portalUrl: myThreadUrl(),
        locale: await platformEmailLocale(loaded.person.email, loaded.thread.language ?? null),
      });
      await sendEmail({ to: loaded.person.email, ...mail, ...(await workspaceSender(loaded.thread.workspace_id)) });
    } catch (e) {
      console.error('[cancellation] rejection email failed', { message: (e as Error).message });
    }
  }
  return c.json({ ok: true });
});
