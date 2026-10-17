// What a cancelled place gets back BY THE RULE (refund rules, slice 2,
// 2026-10-17; Sjoerd's answers A–G, "refunds as recommended").
//
// INFORMATION ONLY in this slice. The participant reads it in my.thread
// before asking; the organiser reads it in the approve dialog. No money moves
// on it yet: the approve action still refunds in full or not at all, exactly
// as before, until slice 3 makes the partial refund — so nothing here can
// suggest an amount the button would not pay (coordinator, 2026-10-17).
//
// The arithmetic is refundFor (lib/refund-rules.ts), the one function slice 3
// will pay by, so the number promised and the number paid cannot drift. This
// file only gathers its inputs:
//   · the RULE — the thread's own (thread_thread.refund_rule), else the
//     workspace default (thread_settings.refund_rule); `{"steps": []}` on the
//     thread = no rule even when the workspace has one;
//   · what was PAID — the purchase ledger's paid row for the place;
//   · the START — the first key moment, else the thread's start date (the
//     same dates every card reads);
//   · the DATE THAT COUNTS — the request's (C), so a slow answer never costs
//     the participant; "now" for the preview before they ask.

import { adminClient } from '../db.js';
import { invalidRule, refundFor, type RefundQuote, type RefundRule } from './refund-rules.js';
import { loadThreadDates } from './thread-dates.js';
import { zonedTimeToUtc } from './availability/timezone.js';

export type RuleSource = 'thread' | 'workspace' | null;

const asRule = (v: unknown): RefundRule | null => {
  if (!v || typeof v !== 'object' || !Array.isArray((v as RefundRule).steps)) return null;
  return invalidRule(v as RefundRule) ? null : (v as RefundRule);
};

/** The rule that applies to a thread, and where it came from. */
export async function effectiveRefundRule(threadId: string): Promise<{ rule: RefundRule | null; source: RuleSource }> {
  const { data: t, error } = await adminClient.from('thread_thread').select('workspace_id, refund_rule').eq('id', threadId).maybeSingle();
  if (error) throw new Error(`refund rule: ${error.message}`);
  if (!t) return { rule: null, source: null };
  const own = asRule(t.refund_rule);
  if (own) return { rule: own.steps.length ? own : null, source: own.steps.length ? 'thread' : null };
  const { data: s } = await adminClient.from('thread_settings').select('refund_rule').eq('workspace_id', t.workspace_id).maybeSingle();
  const ws = asRule(s?.refund_rule);
  return ws && ws.steps.length ? { rule: ws, source: 'workspace' } : { rule: null, source: null };
}

/** When the thread starts, for counting back: its first key moment, else
 *  the start of its first day. Null when it has neither. */
export async function threadStart(threadId: string): Promise<Date | null> {
  const [d, { data: t }] = await Promise.all([
    loadThreadDates([threadId]).then((m) => m.get(threadId)),
    adminClient.from('thread_thread').select('timezone').eq('id', threadId).maybeSingle(),
  ]);
  return startInstant(d?.event?.start ?? d?.period.start ?? null, (t?.timezone as string | null) || 'Europe/Amsterdam');
}

/** A start as an instant. A bare date (a thread with no key moment) starts at
 *  midnight IN THE THREAD'S ZONE, not UTC — "14 days before" an Amsterdam
 *  thread on 1 Dec ends at 00:00 Amsterdam on 17 Nov, an hour before
 *  midnight UTC (refund rules, slice 3b; B5's note on "until" phrasing). */
export function startInstant(s: string | null, timeZone: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return new Date(s);
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, timeZone);
}

/** The paid amount for a place, from the ledger. */
async function paidFor(enrolmentId: string): Promise<{ cents: number; currency: string } | null> {
  const { data: app } = await adminClient.from('app').select('id').eq('slug', 'the-thread').single();
  const { data } = await adminClient
    .from('purchase')
    .select('amount_cents, currency, status')
    .eq('app_id', app!.id)
    .eq('item_ref', enrolmentId)
    .maybeSingle();
  if (!data || data.status !== 'paid') return null;
  return { cents: data.amount_cents as number, currency: data.currency as string };
}

export type PlaceQuote = Omit<RefundQuote, 'changes_at' | 'step'> & {
  currency: string;
  paid_cents: number;
  /** ISO; when a less generous step begins, for "50% until 24 Nov". */
  changes_at: string | null;
  rule_source: RuleSource;
  /** The date the quote was counted at (the request's, or now). */
  counted_at: string;
};

/** The quote for one place at `at`. Null when nothing was paid — a free or
 *  unpaid place has no refund to quote. */
export async function quoteForPlace(enrolmentId: string, threadId: string, at: Date): Promise<PlaceQuote | null> {
  const paid = await paidFor(enrolmentId);
  if (!paid) return null;
  const [{ rule, source }, start] = await Promise.all([effectiveRefundRule(threadId), threadStart(threadId)]);
  const q = refundFor(rule, paid.cents, start, at);
  return {
    pct: q.pct,
    fee_cents: q.fee_cents,
    refund_cents: q.refund_cents,
    reason: q.reason,
    currency: paid.currency,
    paid_cents: paid.cents,
    changes_at: q.changes_at ? q.changes_at.toISOString() : null,
    next_pct: q.next_pct,
    rule_source: source,
    counted_at: at.toISOString(),
  };
}
