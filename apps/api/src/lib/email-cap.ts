// Holding a workspace's scheduled mail when it is past its allowance.
//
// docs/free-plan-limits-and-meet-tiers.md, Gap 1, option 2. Past the cap,
// scheduled messages QUEUE instead of sending; the workspace is told how many
// are waiting; releasing sends them. Chosen over a hard stop because it is the
// only option where our pricing decision does not damage the customer's event.
//
// ---------------------------------------------------------------------------
// WHAT IS HELD, and the boundary that must never move
// ---------------------------------------------------------------------------
// Exactly what `thread_message_send` counts: triggered and scheduled THREAD
// messages. That is the same measure the allowance, the warning mails and
// Settings → Plan already use.
//
// Transactional mail — sign-in codes, invoices, booking confirmations,
// password-less login links — writes no `thread_message_send` row, is not
// counted toward the allowance, and therefore cannot be held by this code
// even in principle. It is not an exemption list that somebody could extend;
// it is a consequence of holding only what is counted. Keep it that way: the
// obvious future "let's count all mail for accuracy" would make a sign-in code
// both billable and holdable, and a person locked out of their account
// because their workspace sent too many newsletters is a failure of a
// different order.

import { adminClient } from '../db.js';
import { planFor, emailsSentBetween, monthStartUTC, can } from './plan.js';

export type CapState = {
  /** Messages counted this calendar month. */
  used: number;
  /** The plan's monthly allowance, or null for "no allowance expressed". */
  included: number | null;
  /** What the plan charges past it, per 1000 — null means it does not bill. */
  overageCentsPer1000: number | null;
  hold: boolean;
};

/**
 * The rule, as a pure function, so the scheduler and anything that explains
 * the state to a person cannot disagree about it.
 *
 * HOLD only when the plan expresses an allowance AND does not bill past it.
 *
 * That second clause is the important one. A paid plan with an overage price
 * has already answered the question "what happens past the cap?" — it bills,
 * at a rate the customer agreed to. Holding a paying customer's mail and
 * asking them to click a button would be a worse product AND a refund
 * conversation. Free is the plan where the overage price is NULL, which the
 * rest of the code already reads as "the allowance is soft and nothing
 * bills"; this makes it mean "and nothing sends past it either", which is
 * what turns 200 from a number on a pricing page into a limit.
 *
 * A plan with no allowance at all (`included === null`) never holds. That is
 * Enterprise and anything comped, and it is the safe direction to fail in.
 *
 * AND the plan must have `email_hold` switched on. That key is off on every
 * plan row as shipped, which makes this whole mechanism inert until somebody
 * turns it on at /admin/plans. Two reasons it is a switch rather than a
 * release boundary: the feature changes what a real customer's event does, so
 * it waits on the production count; and holding mail is only safe once
 * RELEASING it exists, which is the next piece of work. Shipping the hold
 * without the release would park somebody's messages with no way out.
 */
export function shouldHold(opts: {
  enabled: boolean;
  used: number;
  included: number | null;
  overageCentsPer1000: number | null;
}): boolean {
  if (!opts.enabled) return false;
  if (opts.included === null) return false;
  if (opts.overageCentsPer1000 !== null) return false;
  return opts.used >= opts.included;
}

// The scheduler asks this once per message, and a count query per message
// would be one database round trip per recipient of every thread. The answer
// cannot change meaningfully inside one tick: a workspace that is over its
// allowance stays over it until the month turns or somebody upgrades, and
// both of those invalidate the entry explicitly.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; state: CapState }>();

/** Drop a workspace's cached answer — after a release, an upgrade, or a plan
 *  change. Call it anywhere `forgetPlan` is called for the same reason. */
export function forgetCap(workspaceId: string): void {
  cache.delete(workspaceId);
}

export function forgetAllCaps(): void {
  cache.clear();
}

/** Where this workspace stands against its monthly allowance. */
export async function capState(workspaceId: string): Promise<CapState> {
  const hit = cache.get(workspaceId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.state;

  const [plan, used, enabled] = await Promise.all([
    planFor(workspaceId),
    emailsSentBetween(workspaceId, monthStartUTC()),
    can(workspaceId, 'email_hold'),
  ]);
  const state: CapState = {
    used,
    included: plan.includedEmailsMonth,
    overageCentsPer1000: plan.emailOverageCentsPer1000,
    hold: shouldHold({
      enabled,
      used,
      included: plan.includedEmailsMonth,
      overageCentsPer1000: plan.emailOverageCentsPer1000,
    }),
  };
  cache.set(workspaceId, { at: Date.now(), state });
  return state;
}

/**
 * Park one message instead of sending it.
 *
 * Returns true when the caller should NOT send. A failure to record the hold
 * returns false — send it. Losing a message because the parking lot was
 * unavailable is the one outcome worse than sending one over the allowance.
 */
export async function holdMessage(opts: {
  workspaceId: string;
  engagementId: string;
  personId: string;
  email: string;
  dueAt?: Date;
}): Promise<boolean> {
  const { error } = await adminClient.from('thread_message_hold').insert({
    workspace_id: opts.workspaceId,
    engagement_id: opts.engagementId,
    person_id: opts.personId,
    email: opts.email,
    due_at: (opts.dueAt ?? new Date()).toISOString(),
  });
  if (error) {
    // 23505 — already held by an earlier tick. That IS the desired state, so
    // it counts as held and the caller must not send.
    if (error.code === '23505') return true;
    console.error('[email-cap] could not hold a message, sending it instead', error.message);
    return false;
  }
  return true;
}

/** How many messages this workspace has waiting. */
export async function heldCount(workspaceId: string): Promise<number> {
  const { count, error } = await adminClient
    .from('thread_message_hold')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  if (error) {
    console.warn('[email-cap] held count failed', error.message);
    return 0;
  }
  return count ?? 0;
}

export type HeldMessage = {
  id: string;
  engagement_id: string;
  person_id: string;
  email: string;
  due_at: string;
};

/** What is waiting, oldest first — the order the organiser scheduled. */
export async function heldMessages(workspaceId: string, limit = 500): Promise<HeldMessage[]> {
  const { data, error } = await adminClient
    .from('thread_message_hold')
    .select('id, engagement_id, person_id, email, due_at')
    .eq('workspace_id', workspaceId)
    .order('due_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('[email-cap] held list failed', error.message);
    return [];
  }
  return (data ?? []) as HeldMessage[];
}

/** Forget a hold once its message has actually gone out. */
export async function dropHold(id: string): Promise<void> {
  const { error } = await adminClient.from('thread_message_hold').delete().eq('id', id);
  if (error) console.warn('[email-cap] could not drop a released hold', error.message);
}
