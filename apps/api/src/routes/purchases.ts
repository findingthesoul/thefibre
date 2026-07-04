// Platform purchases API — the read/functions side of the Invoices area
// (docs/invoices-and-roles-proposal.md). Scopes: me / team / workspace;
// workspace scope requires admin-or-above. Functions: resend invoice,
// reimburse (Stripe refund on the connected account, platform fee returned
// — D3), mark paid (invoice-method). RLS on public.purchase is the
// backstop for every read.

import { Hono } from 'hono';
import { userClient, adminClient } from '../db.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { sendEmail } from '../lib/email/client.js';
import { shell, escapeHtml } from '../lib/email/templates.js';
import { recordPurchase } from '../lib/purchases.js';
import { finalizePaidEnrolment } from './thread.js';

export const purchasesRoutes = new Hono();

const PURCHASE_SELECT =
  'id, app:app_id (slug, name), person_id, payer_name, payer_email, item_label, item_ref, organiser_user_id, team_id, amount_cents, currency, platform_fee_cents, vendor_share_cents, org_share_cents, method, status, stripe_payment_intent, stripe_invoice_url, paid_at, refunded_at, created_at';

async function workspaceRole(userId: string, workspaceId: string): Promise<string> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role ?? 'organiser';
}

const isAdmin = (role: string) => role === 'admin' || role === 'super_admin';

// Escape PostgREST .or() specials in the search needle.
function likeNeedle(q: string): string {
  return q.replace(/[%,()\\]/g, ' ').trim();
}

// GET /api/v1/purchases?scope=me|team|workspace&team_id=&q=&app=&cursor=
purchasesRoutes.get('/', async (c) => {
    const ctx = c.get('ctx');
    const db = userClient(ctx.jwt);
    const scope = c.req.query('scope') ?? 'me';
    const teamId = c.req.query('team_id');
    const q = (c.req.query('q') ?? '').trim();
    const appSlug = c.req.query('app');
    const cursor = c.req.query('cursor');
    const role = await workspaceRole(ctx.userId, ctx.workspaceId);

    if (scope === 'workspace' && !isAdmin(role)) {
      return c.json({ error: 'workspace scope needs an admin role' }, 403);
    }

    let query = db
      .from('purchase')
      .select(PURCHASE_SELECT)
      .order('created_at', { ascending: false })
      .limit(50);
    if (scope === 'me') query = query.eq('organiser_user_id', ctx.userId);
    if (scope === 'team') {
      if (!teamId) return c.json({ error: 'team_id required for team scope' }, 400);
      query = query.eq('team_id', teamId); // RLS proves membership
    }
    if (appSlug) {
      const { data: app } = await adminClient
        .from('app')
        .select('id')
        .eq('slug', appSlug)
        .maybeSingle();
      if (app) query = query.eq('app_id', app.id);
    }
    if (q) {
      const needle = likeNeedle(q);
      if (needle) {
        query = query.or(
          `payer_name.ilike.%${needle}%,payer_email.ilike.%${needle}%,item_label.ilike.%${needle}%`,
        );
      }
    }
    if (cursor) query = query.lt('created_at', cursor); // keyset pagination (rule #6)

    const { data, error } = await query;
    if (error) return c.json({ error: error.message }, 500);
    const items = data ?? [];
    const nextCursor = items.length === 50 ? items[items.length - 1]!.created_at : null;

    // Totals over the whole current filter (not just the page). Same RLS'd
    // client; capped — beyond that the totals label says "first 2000".
    let totalsQuery = db
      .from('purchase')
      .select('amount_cents, platform_fee_cents, status')
      .limit(2000);
    if (scope === 'me') totalsQuery = totalsQuery.eq('organiser_user_id', ctx.userId);
    if (scope === 'team' && teamId) totalsQuery = totalsQuery.eq('team_id', teamId);
    if (appSlug) {
      const { data: app } = await adminClient
        .from('app')
        .select('id')
        .eq('slug', appSlug)
        .maybeSingle();
      if (app) totalsQuery = totalsQuery.eq('app_id', app.id);
    }
    if (q) {
      const needle = likeNeedle(q);
      if (needle) {
        totalsQuery = totalsQuery.or(
          `payer_name.ilike.%${needle}%,payer_email.ilike.%${needle}%,item_label.ilike.%${needle}%`,
        );
      }
    }
    const { data: totalRows } = await totalsQuery;
    const totals = { paid_cents: 0, pending_cents: 0, refunded_cents: 0, fees_cents: 0, count: 0 };
    for (const r of totalRows ?? []) {
      totals.count += 1;
      if (r.status === 'paid') {
        totals.paid_cents += r.amount_cents;
        totals.fees_cents += r.platform_fee_cents;
      } else if (r.status === 'pending') totals.pending_cents += r.amount_cents;
      else if (r.status === 'refunded') totals.refunded_cents += r.amount_cents;
    }

    return c.json({ items, next_cursor: nextCursor, totals, role });
});

// Shared loader + rights check: admins act on everything, organisers only
// on their own sales (team visibility ≠ team authority).
async function loadForAction(
  jwt: string,
  userId: string,
  workspaceId: string,
  purchaseId: string,
): Promise<
  | { purchase: Record<string, unknown> & { id: string }; appSlug: string }
  | { error: string; code: number }
> {
  const db = userClient(jwt);
  const { data: purchase } = await db
    .from('purchase')
    .select(PURCHASE_SELECT)
    .eq('id', purchaseId)
    .maybeSingle();
  if (!purchase) return { error: 'not found', code: 404 };
  const role = await workspaceRole(userId, workspaceId);
  if (!isAdmin(role) && purchase.organiser_user_id !== userId) {
    return { error: 'only the organiser of this sale (or an admin) can do that', code: 403 };
  }
  const app = Array.isArray(purchase.app) ? purchase.app[0] : purchase.app;
  return { purchase: purchase as never, appSlug: (app as { slug: string })?.slug ?? '' };
}

// POST /api/v1/purchases/:id/resend-invoice — email the payer the hosted
// Stripe invoice link. Invoice-method sales have no document (proposal §3.6).
purchasesRoutes.post('/:id/resend-invoice', async (c) => {
  const ctx = c.get('ctx');
  const r = await loadForAction(ctx.jwt, ctx.userId, ctx.workspaceId, c.req.param('id'));
  if ('error' in r) return c.json({ error: r.error }, r.code as 404);
  const p = r.purchase as unknown as {
    payer_name: string;
    payer_email: string | null;
    item_label: string;
    stripe_invoice_url: string | null;
  };
  if (!p.stripe_invoice_url) {
    return c.json(
      { error: 'no Stripe invoice on this purchase — invoice-method sales carry your own document' },
      409,
    );
  }
  if (!p.payer_email) return c.json({ error: 'no payer email on file' }, 409);
  try {
    await sendEmail({
      to: p.payer_email,
      subject: `Your invoice — ${p.item_label}`,
      html: shell(
        'Your invoice',
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(p.payer_name.split(/\s+/)[0] ?? '')},</p>
         <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Here is the invoice for <strong>${escapeHtml(p.item_label)}</strong>.</p>
         <p style="margin:24px 0;"><a href="${p.stripe_invoice_url}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">View invoice (PDF)</a></p>`,
      ),
      text: `Your invoice for ${p.item_label}: ${p.stripe_invoice_url}`,
    });
  } catch (e) {
    console.error('[purchases] resend invoice failed', e);
    return c.json({ error: 'sending failed — try again' }, 500);
  }
  return c.json({ ok: true });
});

// Resolve the connected Stripe account a purchase was charged on.
async function chargeAccountFor(appSlug: string, itemRef: string): Promise<string | null> {
  if (appSlug === 'fibre-meet') {
    const { data: b } = await adminClient
      .from('meet_booking')
      .select('host:host_id (stripe_account_id)')
      .eq('id', itemRef)
      .maybeSingle();
    const host = b && (Array.isArray(b.host) ? b.host[0] : b.host);
    return host?.stripe_account_id ?? null;
  }
  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select(
      `workspace_id, thread:thread_id (payment_destination, organiser:organiser_id (stripe_account_id, user_id))`,
    )
    .eq('id', itemRef)
    .maybeSingle();
  if (!te) return null;
  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  if (!thread) return null;
  if (thread.payment_destination === 'personal') {
    const org = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
    if (org?.stripe_account_id) return org.stripe_account_id;
    if (org?.user_id) {
      const { data: mh } = await adminClient
        .from('meet_host')
        .select('stripe_account_id')
        .eq('user_id', org.user_id)
        .maybeSingle();
      return mh?.stripe_account_id ?? null;
    }
    return null;
  }
  const { data: ws } = await adminClient
    .from('thread_settings')
    .select('stripe_account_id')
    .eq('workspace_id', te.workspace_id)
    .maybeSingle();
  return ws?.stripe_account_id ?? null;
}

// POST /api/v1/purchases/:id/refund — full refund, platform fee returned.
purchasesRoutes.post('/:id/refund', async (c) => {
  const ctx = c.get('ctx');
  const r = await loadForAction(ctx.jwt, ctx.userId, ctx.workspaceId, c.req.param('id'));
  if ('error' in r) return c.json({ error: r.error }, r.code as 404);
  const p = r.purchase as {
    id: string;
    item_ref: string;
    method: string;
    status: string;
    stripe_payment_intent: string | null;
    workspace_id?: string;
  };
  if (p.status === 'refunded') return c.json({ ok: true, already: true });
  if (p.status !== 'paid') return c.json({ error: 'only paid purchases can be reimbursed' }, 409);

  if (p.method === 'stripe') {
    const stripe = stripeOrNull();
    if (!stripe) return c.json({ error: 'payments not configured' }, 503);
    if (!p.stripe_payment_intent) return c.json({ error: 'no payment intent on record' }, 409);
    const account = await chargeAccountFor(r.appSlug, p.item_ref);
    if (!account) return c.json({ error: 'connected Stripe account not found' }, 409);
    try {
      await stripe.refunds.create(
        // D3: the platform gives its skim back — the organiser is made whole.
        { payment_intent: p.stripe_payment_intent, refund_application_fee: true },
        { stripeAccount: account },
      );
    } catch (e) {
      console.error('[purchases] stripe refund failed', e);
      const msg = e instanceof Error ? e.message : 'refund failed';
      return c.json({ error: msg }, 502);
    }
  }
  // Invoice-method: money moves outside Stripe — this records the fact.

  // Flip the source rows + ledger.
  if (r.appSlug === 'the-thread') {
    await adminClient
      .from('thread_enrolment')
      .update({ payment_status: 'refunded' })
      .eq('id', p.item_ref);
    await adminClient
      .from('thread_payout')
      .update({ status: 'refunded' })
      .eq('thread_enrolment_id', p.item_ref);
  } else if (r.appSlug === 'fibre-meet') {
    await adminClient
      .from('meet_booking')
      .update({ payment_status: 'refunded' })
      .eq('id', p.item_ref);
  }
  await adminClient
    .from('purchase')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', p.id);
  return c.json({ ok: true });
});

// POST /api/v1/purchases/:id/mark-paid — invoice-method only; runs the same
// side-effects the Stripe webhook would.
purchasesRoutes.post('/:id/mark-paid', async (c) => {
  const ctx = c.get('ctx');
  const r = await loadForAction(ctx.jwt, ctx.userId, ctx.workspaceId, c.req.param('id'));
  if ('error' in r) return c.json({ error: r.error }, r.code as 404);
  const p = r.purchase as { id: string; item_ref: string; method: string; status: string };
  if (p.status === 'paid') return c.json({ ok: true, already: true });
  if (p.method !== 'invoice') {
    return c.json({ error: 'only invoice-method purchases can be marked paid by hand' }, 409);
  }

  if (r.appSlug === 'the-thread') {
    await adminClient
      .from('thread_enrolment')
      .update({ payment_status: 'paid' })
      .eq('id', p.item_ref);
    await finalizePaidEnrolment(p.item_ref);
  } else if (r.appSlug === 'fibre-meet') {
    await adminClient.from('meet_booking').update({ payment_status: 'paid' }).eq('id', p.item_ref);
  }
  await adminClient
    .from('purchase')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', p.id);
  return c.json({ ok: true });
});

// Keep recordPurchase importable alongside the routes for the app writers.
export { recordPurchase };
