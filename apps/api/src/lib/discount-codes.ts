// Workspace-wide discount codes: finding one, and proving it may be used.
//
// Codes already worked in The Thread (`thread_coupon`), and the instruction
// was to lift what works rather than invent a second system. What could not
// be lifted is the KEY: that table is `unique (thread_id, code)` and its
// validator takes a thread id, so a membership tier has no shape of it to
// use. `discount_code` is the same columns keyed on the WORKSPACE, plus a
// pair saying what the code applies to.
//
// TENANCY IS THIS FILE'S JOB, and that is a deliberate trade. `applies_to_id`
// has no foreign key, because one polymorphic id cannot contradict itself the
// way four nullable FK columns can — but it also means the database will
// happily hold a code in workspace A naming a thread in workspace B. That is
// the exact shape of both cross-workspace holes found in September 2026, so
// every code with a target is checked against the workspace it belongs to
// before it can affect a price. There is a test for it, and it is the one
// test in here that matters.
//
// PRECEDENCE: thread_coupon FIRST, then this table. A thread's own code wins
// over a workspace code of the same text — the organiser who typed it into
// that thread meant that thread. Both may exist; it is not a conflict.
//
// MATCHING is an exact `.eq()` on the stored lowercased column, never
// `.ilike()`. The thread path used ilike and a visitor typing `*` got a
// discount they had not earned (lib/like-escape.ts, 2026-10-13). A generated
// `code_lower` column removes the question rather than relying on everybody
// remembering to escape.

import { adminClient } from '../db.js';
import { couponPriceOf, type PriceReason } from './member-discount.js';

/** What a code does to a price — the shape `couponPriceOf` already takes, so
 *  the arithmetic has one home and this file never does its own. */
export type DiscountAmount = {
  type: 'percentage' | 'amount' | 'free';
  discount_percentage: number | null;
  discount_amount_cents: number | null;
};

export type DiscountCode = DiscountAmount & {
  id: string;
  code: string;
  workspace_id: string;
  applies_to: 'workspace' | 'thread' | 'ticket' | 'tier' | 'product';
  applies_to_id: string | null;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_early_bird: boolean;
  early_bird_deadline: string | null;
};

/** What the code is being asked about: one thing, named the way the code
 *  would name it. `kind: 'workspace'` is "anything this community sells". */
export type DiscountTarget =
  | { kind: 'thread'; id: string; ticketId?: string | null }
  | { kind: 'tier'; id: string }
  | { kind: 'product'; id: string }
  | { kind: 'workspace' };

export type DiscountResult =
  | { code: DiscountCode }
  /** One sentence, meant to be shown. The reasons are deliberately not
   *  distinguishable from "no such code" where that would help somebody
   *  probing for which codes exist. */
  | { error: string };

const SELECT =
  'id, code, workspace_id, type, discount_percentage, discount_amount_cents, usage_limit, used_count, expires_at, is_early_bird, early_bird_deadline, applies_to, applies_to_id';

/**
 * The code this workspace has under that text, if it may be used here.
 *
 * `now` is a parameter because every rule in here is about time and a rule
 * about time that reads the wall clock passes in UTC CI in October and fails
 * for a real person in December.
 */
export async function findDiscountCode(
  workspaceId: string,
  typed: string,
  target: DiscountTarget,
  now: Date = new Date(),
): Promise<DiscountResult> {
  const code = typed.trim();
  if (!code) return { error: 'this code is not valid' };

  // Exact match on the stored lowercased column — no pattern semantics at
  // all, and it uses the unique index.
  const { data, error } = await adminClient
    .from('discount_code')
    .select(SELECT)
    .eq('workspace_id', workspaceId)
    .eq('code_lower', code.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  // A failed read is NOT "no such code": answering "invalid" because the
  // database was unreachable tells somebody their code is wrong when it is
  // not (lib/rows.ts, the same rule).
  if (error) throw new Error(`discount code lookup: ${error.message}`);
  if (!data) return { error: 'this code is not valid' };
  const found = data as unknown as DiscountCode;

  const nowMs = now.getTime();
  if (found.expires_at && new Date(found.expires_at).getTime() < nowMs) {
    return { error: 'this code has expired' };
  }
  if (
    found.is_early_bird &&
    found.early_bird_deadline &&
    new Date(found.early_bird_deadline).getTime() < nowMs
  ) {
    return { error: 'the early-bird period for this code is over' };
  }
  if (found.usage_limit !== null && found.used_count >= found.usage_limit) {
    return { error: 'this code has been fully used' };
  }

  return (await appliesHere(found, target)) ? { code: found } : { error: 'this code does not apply here' };
}

/**
 * Does this code apply to the thing being bought — and is that thing even
 * this workspace's?
 *
 * THE SECOND HALF IS THE POINT. Without a foreign key, `applies_to_id` is
 * just a uuid somebody typed, and a code in workspace A naming workspace B's
 * thread would otherwise discount B's thread for A's buyers. So the target
 * row is read and its `workspace_id` must equal the code's. A target that
 * has been deleted since reads as "does not apply", which is the honest
 * answer: there is nothing to apply it to.
 */
async function appliesHere(code: DiscountCode, target: DiscountTarget): Promise<boolean> {
  if (code.applies_to === 'workspace') return true;
  if (!code.applies_to_id) return false; // the CHECK forbids this; belt and braces.

  switch (code.applies_to) {
    case 'thread':
      return (
        target.kind === 'thread' &&
        target.id === code.applies_to_id &&
        (await ownedBy('thread_thread', code.applies_to_id, code.workspace_id))
      );
    case 'ticket':
      return (
        target.kind === 'thread' &&
        !!target.ticketId &&
        target.ticketId === code.applies_to_id &&
        (await ownedBy('thread_ticket', code.applies_to_id, code.workspace_id))
      );
    case 'tier':
      return (
        target.kind === 'tier' &&
        target.id === code.applies_to_id &&
        (await ownedBy('membership_tier', code.applies_to_id, code.workspace_id))
      );
    case 'product':
      return (
        target.kind === 'product' &&
        target.id === code.applies_to_id &&
        (await ownedBy('membership_product', code.applies_to_id, code.workspace_id))
      );
    default:
      return false;
  }
}

/** Is this row that workspace's? Missing reads as no — a deleted tier is not
 *  a tier this code may discount. */
async function ownedBy(table: string, id: string, workspaceId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from(table)
    .select('workspace_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`discount code target (${table}): ${error.message}`);
  return !!data && (data as { workspace_id: string }).workspace_id === workspaceId;
}

/** What this code makes the price. The arithmetic itself is
 *  `couponPriceOf` — one implementation, shared with the thread path, so a
 *  percentage can never mean two things. */
export function discountedPrice(code: DiscountCode, baseCents: number): number {
  return couponPriceOf(code, Math.max(0, Math.round(baseCents)));
}

/** The ledger's word for why. Same vocabulary as the thread path, so
 *  /admin/economics can count both together. */
export const DISCOUNT_REASON: PriceReason = 'coupon';

/**
 * Take one use, atomically.
 *
 * The UPDATE is the check (`redeem_discount_code`): it matches only while the
 * code is still active, unexpired and under its limit, so two people
 * redeeming the last use cannot both succeed. The thread path does this as a
 * read-then-write and can oversell; that is a real bug, left alone rather
 * than fixed in passing, and this table does not inherit it.
 *
 * FALSE IS NOT A FAILURE TO HANDLE LOUDLY. Redemption happens at payment
 * confirmation, so a refusal means the last use went to somebody else in the
 * seconds in between. The join is already paid; refusing it then would be
 * worse than honouring one more use of a code. The caller logs and carries
 * on, which is why this returns a boolean rather than throwing.
 */
export async function redeemDiscountCode(codeId: string): Promise<boolean> {
  const { data, error } = await adminClient.rpc('redeem_discount_code', { p_code_id: codeId });
  if (error) {
    console.error('[discount] redeem failed', codeId, error.message);
    return false;
  }
  return data !== null && data !== undefined;
}
