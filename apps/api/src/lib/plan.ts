// What a workspace's plan lets it do.
//
// ONE reader. Every gate asks here and nothing anywhere else looks at
// billing_plan or workspace_subscription — a plan check scattered across
// routes cannot be reasoned about, and the day a price or a package changes,
// the thing you need is a single list of who asks what.
//
// The authoritative plan is workspace_subscription.plan_id. `workspace.plan`,
// the old text column, is legacy and ignored (see 20260519100000).
//
// IT FAILS OPEN, DELIBERATELY. If the lookup errors, `can()` says yes. The
// asymmetry is not close: a database hiccup that quietly downgrades a paying
// festival mid-event costs trust that months of correct billing will not buy
// back, while the same hiccup letting somebody design a template they had not
// paid for costs nothing anybody will notice. Log it and get out of the way.

import { adminClient } from '../db.js';

export type PlanFeature =
  | 'thread'
  | 'thread_custom_templates'
  | 'certificates'
  | 'flow'
  | 'pulse'
  | 'email_branding'
  | 'custom_sender_domain'
  | 'app_keys'
  | 'third_party_apps'
  | 'sso'
  | 'audit_log'
  | 'retention_controls';

export type Plan = {
  id: string;
  name: string;
  priceCentsMonth: number;
  /** Null = not offered yearly (Enterprise is a conversation, not a price). */
  priceCentsYear: number | null;
  /** Tailored price for THIS workspace. Null = list price. Display + Stripe only — never a gate. */
  customPriceCentsMonth: number | null;
  customPriceCentsYear: number | null;
  includedSeats: number | null;
  extraSeatCentsMonth: number | null;
  includedEmailsMonth: number | null;
  includedStorageGb: number | null;
  /** Cents per 1,000 emails past the allowance. Null = overage not billed. */
  emailOverageCentsPer1000: number | null;
  /** Cents per GB past the allowance, per month. Null = overage not billed. */
  storageOverageCentsPerGb: number | null;
  retentionMonths: number | null;
  /** Null means no limit; a number is how many threads may be live at once. */
  threadLiveLimit: number | null;
  /** How many event templates the workspace may use; null = the whole library. */
  threadTemplateLimit: number | null;
  features: Record<string, unknown>;
  /** True when the subscription is not paying but is not cut off either. */
  comped: boolean;
  status: string;
};

// Everything is allowed under the plan we could not read. See the header.
const UNKNOWN: Plan = {
  id: 'unknown',
  name: 'Unknown',
  priceCentsMonth: 0,
  priceCentsYear: null,
  customPriceCentsMonth: null,
  customPriceCentsYear: null,
  includedSeats: null,
  extraSeatCentsMonth: null,
  includedEmailsMonth: null,
  includedStorageGb: null,
  emailOverageCentsPer1000: null,
  storageOverageCentsPerGb: null,
  retentionMonths: null,
  threadLiveLimit: null,
  threadTemplateLimit: null,
  features: {},
  comped: false,
  status: 'unknown',
};

// A plan changes about twice in a workspace's life, and is read on nearly
// every gated request. Sixty seconds is long enough to matter and short enough
// that an upgrade takes effect while the person who paid is still looking at
// the screen.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; plan: Plan }>();

export function forgetPlan(workspaceId: string): void {
  cache.delete(workspaceId);
}

/**
 * Editing a billing_plan row changes the answer for EVERY workspace on that
 * plan; the cache is keyed by workspace, so the only honest invalidation is
 * all of it. Called from the /admin/plans PATCH.
 */
export function forgetAllPlans(): void {
  cache.clear();
}

/**
 * The order every catalogue renders in. Sorting by price puts Enterprise
 * (priced 0 because it is a conversation) before Free; this is the honest
 * ladder. Unknown ids sort after, by price.
 */
const PLAN_ORDER = ['free', 'starter', 'pro', 'org'];
export function sortPlans<T extends { id: string; price_cents_month?: number | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ai = PLAN_ORDER.indexOf(a.id);
    const bi = PLAN_ORDER.indexOf(b.id);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return (a.price_cents_month ?? 0) - (b.price_cents_month ?? 0);
  });
}

export async function planFor(workspaceId: string): Promise<Plan> {
  if (!workspaceId) return UNKNOWN;
  const hit = cache.get(workspaceId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.plan;

  const { data, error } = await adminClient
    .from('workspace_subscription')
    .select(
      `status, custom_price_cents_month, custom_price_cents_year, plan:plan_id (
         id, name, price_cents_month, price_cents_year, included_seats,
         extra_seat_cents_month, included_emails_month, included_storage_gb,
         email_overage_cents_per_1000, storage_overage_cents_per_gb,
         retention_months, features
       )`,
    )
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error || !data?.plan) {
    if (error) console.warn('[plan] lookup failed, allowing everything', error.message);
    return UNKNOWN;
  }
  const row = (Array.isArray(data.plan) ? data.plan[0] : data.plan) as {
    id: string;
    name: string;
    price_cents_month: number;
    price_cents_year: number | null;
    included_seats: number | null;
    extra_seat_cents_month: number | null;
    included_emails_month: number | null;
    included_storage_gb: number | null;
    email_overage_cents_per_1000: number | null;
    storage_overage_cents_per_gb: number | null;
    retention_months: number | null;
    features: Record<string, unknown> | null;
  };
  const features = row.features ?? {};
  const plan: Plan = {
    id: row.id,
    name: row.name,
    priceCentsMonth: row.price_cents_month ?? 0,
    priceCentsYear: row.price_cents_year ?? null,
    customPriceCentsMonth: data.custom_price_cents_month ?? null,
    customPriceCentsYear: data.custom_price_cents_year ?? null,
    includedSeats: row.included_seats,
    extraSeatCentsMonth: row.extra_seat_cents_month,
    includedEmailsMonth: row.included_emails_month,
    includedStorageGb: row.included_storage_gb,
    emailOverageCentsPer1000: row.email_overage_cents_per_1000 ?? null,
    storageOverageCentsPerGb: row.storage_overage_cents_per_gb ?? null,
    retentionMonths: row.retention_months,
    threadLiveLimit:
      typeof features.thread_live_limit === 'number' ? features.thread_live_limit : null,
    threadTemplateLimit:
      typeof features.thread_template_limit === 'number' ? features.thread_template_limit : null,
    features,
    comped: data.status === 'comped',
    status: data.status,
  };
  cache.set(workspaceId, { at: Date.now(), plan });
  return plan;
}

export async function can(workspaceId: string, feature: PlanFeature): Promise<boolean> {
  const plan = await planFor(workspaceId);
  if (plan.id === 'unknown') return true;
  return plan.features[feature] === true;
}

/**
 * What a refusal says. Never "upgrade to continue" with nothing else — it
 * names the thing being refused, the plan that has it, and leaves the person
 * able to explain the charge to whoever approves it.
 */
export function needsPlan(what: string, planName: string): string {
  return `${what} is part of ${planName}. Your current plan does not include it — Settings → Plan has the details.`;
}

/**
 * Seats are people who RUN events: a live user row in the workspace.
 * Participants are never seats, and never become one by enrolling.
 */
export async function seatsUsed(workspaceId: string): Promise<number> {
  const { count } = await adminClient
    .from('user')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);
  return count ?? 0;
}

/**
 * Whether one more person may be added.
 *
 * A workspace already OVER its allowance keeps everybody — the limit binds on
 * the next invite, never retroactively. Nobody is removed from a workspace by
 * a pricing change, so this only ever answers "may we add one more".
 */
export async function seatAvailable(
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; used: number; included: number; extraCents: number | null }> {
  const plan = await planFor(workspaceId);
  if (plan.includedSeats === null) return { ok: true };
  const used = await seatsUsed(workspaceId);
  if (used < plan.includedSeats) return { ok: true };
  return {
    ok: false,
    used,
    included: plan.includedSeats,
    extraCents: plan.extraSeatCentsMonth,
  };
}

/**
 * Emails this workspace sent in [from, to). thread_message_send is one row per
 * (engagement, person) — one email, and already written by every triggered
 * send. No new instrumentation.
 *
 * It carries no workspace of its own, so the count reaches one through the
 * engagement's thread. !inner makes the join a filter rather than a
 * left-join that would count every workspace's mail as this one's.
 */
export async function emailsSentBetween(
  workspaceId: string,
  from: Date,
  to?: Date,
): Promise<number> {
  let q = adminClient
    .from('thread_message_send')
    .select('id, engagement:engagement_id!inner(thread:thread_id!inner(workspace_id))', {
      count: 'exact',
      head: true,
    })
    .eq('engagement.thread.workspace_id', workspaceId)
    .gte('sent_at', from.toISOString());
  if (to) q = q.lt('sent_at', to.toISOString());
  const { count, error } = await q;
  if (error) console.warn('[plan] email usage count failed', error.message);
  return count ?? 0;
}

/** First instant (UTC) of the calendar month `monthsAgo` months back. */
export function monthStartUTC(monthsAgo = 0): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d;
}

/** Emails this workspace has sent this calendar month, against its bundle. */
export async function emailUsage(
  workspaceId: string,
): Promise<{ sent: number; included: number | null }> {
  const plan = await planFor(workspaceId);
  const sent = await emailsSentBetween(workspaceId, monthStartUTC());
  return { sent, included: plan.includedEmailsMonth };
}

/**
 * Bytes this workspace has uploaded — storage.objects under the workspace-
 * prefixed paths both upload routes write (thread-assets + fibre-assets),
 * summed by the SECURITY DEFINER function from 20260906110000. GB here is
 * decimal (10^9), matching what the plan matrix and pricing page say.
 */
export async function storageUsage(
  workspaceId: string,
): Promise<{ bytes: number; includedGb: number | null }> {
  const plan = await planFor(workspaceId);
  const { data, error } = await adminClient.rpc('workspace_storage_bytes', { ws: workspaceId });
  if (error) console.warn('[plan] storage usage count failed', error.message);
  return { bytes: typeof data === 'number' ? data : Number(data ?? 0), includedGb: plan.includedStorageGb };
}
