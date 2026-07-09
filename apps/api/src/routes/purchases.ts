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
import { settleFromPurchase } from '../lib/pulse-ledger.js';
import { finalizePaidEnrolment } from './thread.js';
import {
  chargeAccountForItem,
  personalInvoiceDetails,
  workspaceInvoiceDetails,
} from '../lib/payment-accounts.js';
import { platformFeeCents } from '../lib/fees.js';

export const purchasesRoutes = new Hono();

const PURCHASE_SELECT =
  'id, app:app_id (slug, name), person_id, payer_name, payer_email, item_label, item_ref, organiser_user_id, team_id, amount_cents, currency, platform_fee_cents, vendor_share_cents, org_share_cents, method, status, stripe_payment_intent, stripe_invoice_url, stripe_account_id, billing, paid_at, refunded_at, created_at';

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
      .select('amount_cents, platform_fee_cents, status, currency')
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
    // Per-currency totals — mixed currencies must never be summed together.
    const byCurrency = new Map<
      string,
      { currency: string; paid_cents: number; pending_cents: number; refunded_cents: number; fees_cents: number }
    >();
    let count = 0;
    for (const r of totalRows ?? []) {
      count += 1;
      const cur = ((r as { currency?: string }).currency ?? 'EUR').toUpperCase();
      let t = byCurrency.get(cur);
      if (!t) {
        t = { currency: cur, paid_cents: 0, pending_cents: 0, refunded_cents: 0, fees_cents: 0 };
        byCurrency.set(cur, t);
      }
      if (r.status === 'paid') {
        t.paid_cents += r.amount_cents;
        t.fees_cents += r.platform_fee_cents;
      } else if (r.status === 'pending') t.pending_cents += r.amount_cents;
      else if (r.status === 'refunded') t.refunded_cents += r.amount_cents;
    }
    const totals = { count, currencies: [...byCurrency.values()] };

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

type ReceiptPurchase = {
  payer_name: string;
  payer_email: string | null;
  item_label: string;
  amount_cents: number;
  currency: string;
  method: string;
  status?: string;
  created_at: string;
  billing?: { company?: string; address?: string; postal_code?: string; city?: string; country?: string; tax_no?: string } | null;
};

type SellerDetails = { legal_name?: string; address?: string; tax_no?: string } | null;

/** The invoice issuer's identity for a purchase — personal or workspace.
 *  Resolves through the payments SPoT (review 2026-07-05: this read the
 *  legacy columns directly, so Settings → Payments edits never reached
 *  receipts). */
async function sellerDetailsFor(
  workspaceId: string,
  organiserUserId: string | null,
): Promise<SellerDetails> {
  if (organiserUserId) {
    const personal = await personalInvoiceDetails(organiserUserId);
    if (personal) return personal as SellerDetails;
  }
  return ((await workspaceInvoiceDetails(workspaceId)) as SellerDetails) ?? null;
}

// Receipt-styled email body (Sjoerd 2026-07-04: "look like a receipt").
function receiptHtml(p: ReceiptPurchase, buttonHtml: string, seller?: SellerDetails): string {
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: p.currency || 'EUR',
  }).format(p.amount_cents / 100);
  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(p.created_at));
  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:8px 0;font-size:13px;color:#6b7280;">${escapeHtml(label)}</td>
       <td style="padding:8px 0;font-size:13px;color:#171717;text-align:right;">${escapeHtml(value)}</td>
     </tr>`;
  const sellerRows = seller
    ? [
        seller.legal_name ? row('From', seller.legal_name) : '',
        seller.address ? row('', seller.address) : '',
        seller.tax_no ? row('Tax / VAT no. (seller)', seller.tax_no) : '',
      ].join('')
    : '';
  const billingAddress = [
    p.billing?.address,
    [p.billing?.postal_code, p.billing?.city].filter(Boolean).join(' '),
    p.billing?.country,
  ]
    .filter(Boolean)
    .join(', ');
  const billingRows = [
    p.billing?.company ? row('Billed to', p.billing.company) : '',
    billingAddress ? row('Address', billingAddress) : '',
    p.billing?.tax_no ? row('Tax / VAT no.', p.billing.tax_no) : '',
  ].join('');
  // A pending purchase is an invoice, not a receipt — say so
  // (review 2026-07-05: resend on a pending row mailed a "Receipt" with a
  // Total for money not yet paid).
  const settled = p.status !== 'pending';
  const methodLabel =
    p.method === 'invoice'
      ? settled
        ? 'By invoice'
        : 'By invoice — awaiting payment'
      : p.method === 'free'
        ? 'Free (discount code)'
        : 'Card';
  return shell(
    settled ? 'Receipt' : 'Invoice',
    `<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">Hi ${escapeHtml(
      p.payer_name.split(/\s+/)[0] ?? '',
    )},</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="border:1px solid #e5e5e2;border-radius:10px;border-collapse:separate;padding:20px 24px;">
       <tr>
         <td colspan="2" style="padding:0 0 12px;border-bottom:1px solid #e5e5e2;">
           <span style="font-size:15px;font-weight:600;color:#171717;">${escapeHtml(p.item_label)}</span>
         </td>
       </tr>
       ${row('Date', date)}
       ${row('Payment', methodLabel)}
       ${sellerRows}
       ${billingRows}
       <tr>
         <td style="padding:14px 0 0;border-top:1px solid #e5e5e2;font-size:14px;font-weight:600;color:#171717;">Total</td>
         <td style="padding:14px 0 0;border-top:1px solid #e5e5e2;font-size:18px;font-weight:600;color:#171717;text-align:right;">${amount}</td>
       </tr>
     </table>
     ${buttonHtml}`,
  );
}

// Reusable: email the payer their receipt (with the hosted invoice PDF
// button when one exists). Settled purchases without a Stripe document
// still get the receipt itself.
async function sendReceipt(
  workspaceId: string,
  purchase: Record<string, unknown>,
): Promise<{ ok: true } | { error: string; code: number }> {
  const p = purchase as unknown as {
    payer_name: string;
    payer_email: string | null;
    item_label: string;
    stripe_invoice_url: string | null;
    organiser_user_id?: string | null;
    status?: string;
  };
  if (!p.payer_email) return { error: 'no payer email on file', code: 409 };
  const seller = await sellerDetailsFor(workspaceId, p.organiser_user_id ?? null);
  const button = p.stripe_invoice_url
    ? `<p style="margin:24px 0 0;"><a href="${p.stripe_invoice_url}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">View invoice (PDF)</a></p>`
    : '';
  try {
    await sendEmail({
      to: p.payer_email,
      subject: `${p.status === 'pending' ? 'Invoice' : 'Your receipt'} — ${p.item_label}`,
      html: receiptHtml(purchase as unknown as ReceiptPurchase, button, seller),
      text: `Your receipt for ${p.item_label}${p.stripe_invoice_url ? `: ${p.stripe_invoice_url}` : ''}`,
    });
  } catch (e) {
    console.error('[purchases] resend receipt failed', e);
    return { error: 'sending failed — try again', code: 500 };
  }
  return { ok: true };
}

// POST /api/v1/purchases/:id/resend-invoice — receipt to the payer.
purchasesRoutes.post('/:id/resend-invoice', async (c) => {
  const ctx = c.get('ctx');
  const r = await loadForAction(ctx.jwt, ctx.userId, ctx.workspaceId, c.req.param('id'));
  if ('error' in r) return c.json({ error: r.error }, r.code as 404);
  const sent = await sendReceipt(ctx.workspaceId, r.purchase);
  if ('error' in sent) return c.json({ error: sent.error }, sent.code as 409);
  return c.json({ ok: true });
});

// POST /api/v1/purchases/resend-by-ref — same, addressed by the app-local
// row (the participant popup only knows the enrolment id).
purchasesRoutes.post('/resend-by-ref', async (c) => {
  const ctx = c.get('ctx');
  const body = (await c.req.json().catch(() => null)) as
    | { app?: string; item_ref?: string }
    | null;
  if (!body?.app || !body.item_ref) return c.json({ error: 'app and item_ref required' }, 400);
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', body.app)
    .maybeSingle();
  if (!app) return c.json({ error: 'unknown app' }, 400);
  const { data: purchase } = await adminClient
    .from('purchase')
    .select('id')
    .eq('app_id', app.id)
    .eq('item_ref', body.item_ref)
    .maybeSingle();
  if (!purchase) return c.json({ error: 'no purchase recorded for this enrolment' }, 404);
  const r = await loadForAction(ctx.jwt, ctx.userId, ctx.workspaceId, purchase.id);
  if ('error' in r) return c.json({ error: r.error }, r.code as 404);
  const sent = await sendReceipt(ctx.workspaceId, r.purchase);
  if ('error' in sent) return c.json({ error: sent.error }, sent.code as 409);
  return c.json({ ok: true });
});

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
  if (p.method === 'free') {
    // €0-with-code rows are ledger facts, not payments — flipping them to
    // 'refunded' would irreversibly mislabel the enrolment.
    return c.json({ error: 'a free enrolment has nothing to reimburse' }, 409);
  }

  if (p.method === 'stripe') {
    const stripe = stripeOrNull();
    if (!stripe) return c.json({ error: 'payments not configured' }, 503);
    if (!p.stripe_payment_intent) return c.json({ error: 'no payment intent on record' }, 409);
    // The account the charge actually landed on (stored at record time);
    // today's settings only as fallback for pre-migration rows.
    const account =
      (r.purchase as { stripe_account_id?: string | null }).stripe_account_id ??
      (await chargeAccountForItem(r.appSlug, p.item_ref));
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

// POST /api/v1/purchases/:id/send-payment-link — invoice-method purchases
// get an online way out: a Stripe Checkout session for the pending amount,
// mailed as a receipt with a Pay button. The existing webhook completes it.
// Thread-only in v1 (Meet invoice bookings are marked paid by the host).
purchasesRoutes.post('/:id/send-payment-link', async (c) => {
  const ctx = c.get('ctx');
  const r = await loadForAction(ctx.jwt, ctx.userId, ctx.workspaceId, c.req.param('id'));
  if ('error' in r) return c.json({ error: r.error }, r.code as 404);
  const p = r.purchase as unknown as ReceiptPurchase & {
    id: string;
    item_ref: string;
    method: string;
    status: string;
  };
  if (p.method !== 'invoice' || p.status !== 'pending') {
    return c.json({ error: 'payment links apply to pending invoice-method purchases' }, 409);
  }
  if (r.appSlug !== 'the-thread') {
    return c.json({ error: 'payment links are available for Thread purchases only (for now)' }, 409);
  }
  if (!p.payer_email) return c.json({ error: 'no payer email on file' }, 409);
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments not configured' }, 503);

  const account = await chargeAccountForItem(r.appSlug, p.item_ref);
  if (!account) return c.json({ error: 'connected Stripe account not found' }, 409);

  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select('id, workspace_id, thread:thread_id (slug, organiser:organiser_id (slug), team:team_id (slug))')
    .eq('id', p.item_ref)
    .maybeSingle();
  if (!te) return c.json({ error: 'source enrolment missing' }, 409);
  // Same plan-aware fee rule as checkout (lib/fees).
  const applicationFeeCents = await platformFeeCents(te.workspace_id, p.amount_cents);

  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  const organiser = thread && (Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser);
  const team = thread && (Array.isArray(thread.team) ? thread.team[0] : thread.team);
  const threadUrl = process.env.THREAD_APP_URL ?? 'https://thread.thefibre.app';
  const publicBase = `${threadUrl}/${team?.slug ?? organiser?.slug ?? ''}/${thread?.slug ?? ''}`;

  // A resend must kill the previous session — the old link would stay
  // payable while the webhook only knows the newest session id.
  const { data: prevTe } = await adminClient
    .from('thread_enrolment')
    .select('stripe_session_id')
    .eq('id', p.item_ref)
    .maybeSingle();
  if (prevTe?.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(prevTe.stripe_session_id, undefined, {
        stripeAccount: account,
      });
    } catch {
      /* already expired or completed — fine */
    }
  }

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: (p.currency || 'EUR').toLowerCase(),
              unit_amount: p.amount_cents,
              product_data: { name: p.item_label },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeCents,
          metadata: { thread_enrolment_id: p.item_ref },
        },
        customer_email: p.payer_email,
        metadata: { thread_enrolment_id: p.item_ref },
        invoice_creation: { enabled: true },
        billing_address_collection: 'required',
        success_url: `${publicBase}?paid=success`,
        cancel_url: `${publicBase}?paid=cancelled`,
      },
      { stripeAccount: account },
    );
    await adminClient
      .from('thread_enrolment')
      .update({ stripe_session_id: session.id })
      .eq('id', p.item_ref);
    await adminClient
      .from('purchase')
      .update({ stripe_account_id: account })
      .eq('id', p.id);
    const seller = await sellerDetailsFor(
      ctx.workspaceId,
      (r.purchase as { organiser_user_id?: string | null }).organiser_user_id ?? null,
    );
    await sendEmail({
      to: p.payer_email,
      subject: `Payment link — ${p.item_label}`,
      html: receiptHtml(
        p,
        `<p style="margin:24px 0 0;"><a href="${session.url}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Pay online</a></p>
         <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Prefer the invoice? Just ignore this button — the invoice stands.</p>`,
        seller,
      ),
      text: `Pay online for ${p.item_label}: ${session.url}`,
    });
  } catch (e) {
    console.error('[purchases] payment link failed', e);
    return c.json({ error: 'could not create the payment link' }, 502);
  }
  return c.json({ ok: true });
});

// POST /api/v1/purchases/:id/mark-paid — invoice-method only; runs the same
// side-effects the Stripe webhook would.
purchasesRoutes.post('/:id/mark-paid', async (c) => {
  const ctx = c.get('ctx');
  // Optional body (Sjoerd 2026-07-10: "when mark as paid, you need to
  // connect a bank account and a date"): the receiving account + paid date.
  const body = (await c.req.json().catch(() => ({}))) as {
    paid_date?: string;
    account_id?: string;
  };
  const paidAt =
    body.paid_date && /^\d{4}-\d{2}-\d{2}$/.test(body.paid_date)
      ? new Date(body.paid_date + 'T12:00:00Z').toISOString()
      : new Date().toISOString();
  const r = await loadForAction(ctx.jwt, ctx.userId, ctx.workspaceId, c.req.param('id'));
  if ('error' in r) return c.json({ error: r.error }, r.code as 404);
  const p = r.purchase as {
    id: string;
    item_ref: string;
    method: string;
    status: string;
    amount_cents?: number;
  };
  if (p.status === 'paid') return c.json({ ok: true, already: true });
  if (p.status !== 'pending') {
    return c.json({ error: `a ${p.status} purchase cannot be marked paid` }, 409);
  }
  if (p.method !== 'invoice') {
    return c.json({ error: 'only invoice-method purchases can be marked paid by hand' }, 409);
  }

  if (r.appSlug === 'the-thread') {
    // A live checkout session would stay payable after the manual mark —
    // expire it (double-pay guard, review 2026-07-05; same rule as decline
    // and payment-link resend).
    const { data: teSess } = await adminClient
      .from('thread_enrolment')
      .select('stripe_session_id')
      .eq('id', p.item_ref)
      .maybeSingle();
    if (teSess?.stripe_session_id) {
      const stripe = stripeOrNull();
      const account =
        (r.purchase as { stripe_account_id?: string | null }).stripe_account_id ??
        (await chargeAccountForItem(r.appSlug, p.item_ref));
      if (stripe && account) {
        try {
          await stripe.checkout.sessions.expire(teSess.stripe_session_id, undefined, {
            stripeAccount: account,
          });
        } catch {
          /* already expired or completed */
        }
      }
    }
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
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', p.id);

  // The money landed somewhere: bump the chosen account's balance with a new
  // snapshot (old latest + amount, dated the paid date). A later manual
  // balance entry simply supersedes it — snapshots are append-only.
  if (body.account_id && p.amount_cents) {
    const { data: acc } = await adminClient
      .from('pulse_account')
      .select('id, workspace_id')
      .eq('id', body.account_id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (acc) {
      const { data: last } = await adminClient
        .from('pulse_balance_snapshot')
        .select('balance_cents')
        .eq('account_id', acc.id)
        .order('as_of_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      await adminClient.from('pulse_balance_snapshot').insert({
        account_id: acc.id,
        balance_cents: (last?.balance_cents ?? 0) + p.amount_cents,
        as_of_date: paidAt.slice(0, 10),
        created_by: ctx.userId,
      });
    }
  }

  // Pulse plan sync: paid settles what this purchase belongs to.
  await settleFromPurchase(p.id);
  return c.json({ ok: true });
});

// Keep recordPurchase importable alongside the routes for the app writers.
export { recordPurchase };
