// Meters that bill — the P4 remainder (docs/productisation-proposal.md §4).
//
// Three sweeps, one tick:
//   1. 80% warnings   — when email or storage crosses 80% of the plan's
//                       allowance, the workspace admins get ONE email per
//                       (meter, calendar month). The dedup is a row in
//                       usage_warning with a UNIQUE constraint, so however
//                       often the tick runs, a crossing emails once.
//   2. Overage lines  — for workspaces with a live Stripe subscription, last
//                       month's usage past the allowance becomes a Stripe
//                       invoice item (it rides the next subscription invoice).
//                       Unit prices are billing_plan columns, editable on
//                       /admin/plans; NULL = the allowance is soft and nothing
//                       bills. Dedup: usage_overage_charge, one row per
//                       (workspace, meter, closed month).
//   3. Free archive   — a Free workspace with no sign-ins and no activity for
//                       12 months gets a warning email (export pointer
//                       included); at 13 months — and never less than 30 days
//                       after the warning — it is flagged archived. A FLAG:
//                       nothing is deleted, POST /billing/reactivate undoes it.
//
// Everything fails SOFT (the seat-billing posture): a hiccup logs and the next
// tick converges. Nothing here ever gates a feature — gates follow plan_id.
//
// Wired from routes/billing.ts (runBillingMeterTick) into server.ts's 5-minute
// scheduler interval; an internal hourly guard keeps the sweeps from running
// more often than the data changes meaningfully.

import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { planFor, emailsSentBetween, storageUsage, monthStartUTC, type Plan } from './plan.js';
import { sendEmail } from './email/client.js';
import { renderUsageWarningEmail, renderInactivityWarningEmail } from './email/usage-templates.js';

/** Decimal GB, matching the plan matrix and the pricing page. */
const GB = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;
const n = (v: number) => v.toLocaleString('en-GB');
const gb = (bytes: number) => `${(bytes / GB).toFixed(bytes >= GB ? 1 : 2)} GB`;
const dateLabel = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

type SubscriptionRow = {
  workspace_id: string;
  plan_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  workspace: {
    name: string;
    created_at: string;
    archived_at: string | null;
    archive_warned_at: string | null;
  } | null;
};

async function allSubscriptions(): Promise<SubscriptionRow[]> {
  const { data, error } = await adminClient
    .from('workspace_subscription')
    .select(
      `workspace_id, plan_id, status, stripe_customer_id, stripe_subscription_id,
       workspace:workspace_id (name, created_at, archived_at, archive_warned_at)`,
    );
  if (error) {
    console.error('[meters] subscription list failed', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    ...r,
    workspace: (Array.isArray(r.workspace) ? r.workspace[0] : r.workspace) ?? null,
  })) as SubscriptionRow[];
}

/** Admin recipients — the people who can act on a plan or a bill. */
async function adminEmails(workspaceId: string): Promise<string[]> {
  const { data: members } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('workspace_role', ['admin', 'super_admin']);
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: users } = await adminClient
    .from('user')
    .select('email')
    .in('id', ids)
    .is('deleted_at', null);
  return [...new Set((users ?? []).map((u) => u.email as string).filter(Boolean))];
}

// ---------------------------------------------------------------------------
// 1 · 80% warnings
// ---------------------------------------------------------------------------

type MeterReading = {
  meter: 'emails' | 'storage';
  used: number; // emails, or bytes
  allowance: number; // emails, or bytes
  usedLabel: string;
  allowanceLabel: string;
  overagePriceLine: string | null;
};

function readings(plan: Plan, emailsSent: number, storageBytes: number): MeterReading[] {
  const out: MeterReading[] = [];
  if (plan.includedEmailsMonth !== null) {
    out.push({
      meter: 'emails',
      used: emailsSent,
      allowance: plan.includedEmailsMonth,
      usedLabel: `${n(emailsSent)} emails`,
      allowanceLabel: n(plan.includedEmailsMonth),
      overagePriceLine:
        plan.emailOverageCentsPer1000 !== null
          ? `${eur(plan.emailOverageCentsPer1000)} per 1,000 emails over`
          : null,
    });
  }
  if (plan.includedStorageGb !== null) {
    out.push({
      meter: 'storage',
      used: storageBytes,
      allowance: plan.includedStorageGb * GB,
      usedLabel: gb(storageBytes),
      allowanceLabel: `${n(plan.includedStorageGb)} GB`,
      overagePriceLine:
        plan.storageOverageCentsPerGb !== null
          ? `${eur(plan.storageOverageCentsPerGb)} per GB over`
          : null,
    });
  }
  return out;
}

async function sweepUsageWarnings(rows: SubscriptionRow[]): Promise<void> {
  const periodStart = monthStartUTC().toISOString().slice(0, 10);
  for (const row of rows) {
    if (!row.workspace || row.workspace.archived_at) continue;
    try {
      const plan = await planFor(row.workspace_id);
      if (plan.id === 'unknown') continue;
      if (plan.includedEmailsMonth === null && plan.includedStorageGb === null) continue;

      const [emailsSent, storage] = await Promise.all([
        plan.includedEmailsMonth !== null
          ? emailsSentBetween(row.workspace_id, monthStartUTC())
          : Promise.resolve(0),
        plan.includedStorageGb !== null
          ? storageUsage(row.workspace_id)
          : Promise.resolve({ bytes: 0, includedGb: null }),
      ]);

      for (const r of readings(plan, emailsSent, storage.bytes)) {
        if (r.allowance <= 0 || r.used < r.allowance * 0.8) continue;

        // The dedup IS the insert: the unique constraint on (workspace, meter,
        // period) makes the second crossing of a month a 23505, not an email.
        const { error } = await adminClient.from('usage_warning').insert({
          workspace_id: row.workspace_id,
          meter: r.meter,
          period_start: periodStart,
          used: Math.round(r.used),
          allowance: Math.round(r.allowance),
        });
        if (error) {
          if (error.code !== '23505') console.error('[meters] warning stamp failed', error.message);
          continue;
        }

        const recipients = await adminEmails(row.workspace_id);
        const mail = renderUsageWarningEmail({
          workspaceName: row.workspace.name,
          meter: r.meter,
          usedLabel: r.usedLabel,
          allowanceLabel: r.allowanceLabel,
          overagePriceLine: r.overagePriceLine,
        });
        for (const to of recipients) {
          void sendEmail({ to, ...mail }).catch((e) =>
            console.error('[meters] warning email failed', row.workspace_id, e),
          );
        }
        console.log(`[meters] 80% warning: ${row.workspace_id} ${r.meter} (${r.usedLabel}/${r.allowanceLabel})`);
      }
    } catch (e) {
      console.error('[meters] warning sweep failed for', row.workspace_id, e);
    }
  }
}

// ---------------------------------------------------------------------------
// 2 · Overage invoice lines (paid plans, closed calendar month)
// ---------------------------------------------------------------------------

async function sweepOverageBilling(rows: SubscriptionRow[]): Promise<void> {
  const stripe = stripeOrNull();
  if (!stripe) return;

  const periodStart = monthStartUTC(1); // first day of LAST month
  const periodEnd = monthStartUTC(0); // first day of THIS month
  const periodKey = periodStart.toISOString().slice(0, 10);
  const monthLabel = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  for (const row of rows) {
    // Only real, live Stripe subscriptions carry overage. Comped never bills;
    // Free has nothing to attach a line to.
    if (!row.stripe_subscription_id || !row.stripe_customer_id) continue;
    if (row.status === 'comped') continue;
    if (!['active', 'trialing', 'past_due'].includes(row.status)) continue;

    try {
      const plan = await planFor(row.workspace_id);
      if (plan.id === 'unknown') continue;

      const charges: { meter: 'emails' | 'storage'; quantity: number; cents: number; desc: string }[] =
        [];

      if (plan.includedEmailsMonth !== null && plan.emailOverageCentsPer1000 !== null) {
        const sent = await emailsSentBetween(row.workspace_id, periodStart, periodEnd);
        const over = Math.max(0, sent - plan.includedEmailsMonth);
        const cents = Math.round((over * plan.emailOverageCentsPer1000) / 1000);
        if (over > 0 && cents > 0) {
          charges.push({
            meter: 'emails',
            quantity: over,
            cents,
            desc: `Email overage — ${n(over)} past the ${n(plan.includedEmailsMonth)} included (${monthLabel})`,
          });
        }
      }

      if (plan.includedStorageGb !== null && plan.storageOverageCentsPerGb !== null) {
        // Storage is a level, not a flow; the month is billed on where it
        // stood at month end (measured on the first sweep after the month
        // closes). Whole GB, rounded up — the unit the price names.
        const { bytes } = await storageUsage(row.workspace_id);
        const overGb = Math.max(0, Math.ceil(bytes / GB) - plan.includedStorageGb);
        const cents = overGb * plan.storageOverageCentsPerGb;
        if (overGb > 0 && cents > 0) {
          charges.push({
            meter: 'storage',
            quantity: overGb,
            cents,
            desc: `Storage overage — ${n(overGb)} GB past the ${n(plan.includedStorageGb)} GB included (${monthLabel})`,
          });
        }
      }

      for (const ch of charges) {
        // Dedup + crash-recovery in one shape: a row with an invoice-item id
        // is done; a row without one is a half-flight from a crash and gets
        // its Stripe call retried; no row means bill now.
        const { data: existing } = await adminClient
          .from('usage_overage_charge')
          .select('id, stripe_invoice_item_id')
          .eq('workspace_id', row.workspace_id)
          .eq('meter', ch.meter)
          .eq('period_start', periodKey)
          .maybeSingle();
        if (existing?.stripe_invoice_item_id) continue;

        let chargeRowId = existing?.id as string | undefined;
        if (!chargeRowId) {
          const { data: inserted, error } = await adminClient
            .from('usage_overage_charge')
            .insert({
              workspace_id: row.workspace_id,
              meter: ch.meter,
              period_start: periodKey,
              quantity: ch.quantity,
              amount_cents: ch.cents,
            })
            .select('id')
            .maybeSingle();
          if (error) {
            if (error.code !== '23505')
              console.error('[meters] overage stamp failed', error.message);
            continue; // 23505 = another tick got here first
          }
          chargeRowId = inserted?.id;
        }
        if (!chargeRowId) continue;

        try {
          // A pending invoice item rides the subscription's NEXT invoice —
          // the monthly bill simply carries the line. Plan-aware price, never
          // hardcoded: the cents came from billing_plan above.
          const item = await stripe.invoiceItems.create({
            customer: row.stripe_customer_id,
            subscription: row.stripe_subscription_id,
            currency: 'eur',
            amount: ch.cents,
            description: ch.desc,
          });
          await adminClient
            .from('usage_overage_charge')
            .update({ stripe_invoice_item_id: item.id })
            .eq('id', chargeRowId);
          console.log(`[meters] overage billed: ${row.workspace_id} ${ch.meter} ${eur(ch.cents)} (${monthLabel})`);
        } catch (e) {
          // Leave the row WITHOUT an item id — the next sweep retries Stripe
          // against the same stamp instead of double-billing.
          console.error('[meters] Stripe invoice item failed (will retry)', row.workspace_id, ch.meter, e);
        }
      }
    } catch (e) {
      console.error('[meters] overage sweep failed for', row.workspace_id, e);
    }
  }
}

// ---------------------------------------------------------------------------
// 3 · 13-month Free archive
// ---------------------------------------------------------------------------

/**
 * When this workspace was last ALIVE, defensibly: the latest of
 *   - any member's last sign-in (public."user".last_sign_in),
 *   - the newest activity row (append-only, so this is every app's pulse —
 *     enrolments, sends, check-ins all land here via the event log),
 *   - the workspace's own created_at (a floor, so a never-used workspace
 *     ages from birth rather than being undefined).
 */
async function lastActiveAt(workspaceId: string, createdAt: string): Promise<Date> {
  const [{ data: user }, { data: act }] = await Promise.all([
    adminClient
      .from('user')
      .select('last_sign_in')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('last_sign_in', 'is', null)
      .order('last_sign_in', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('activity')
      .select('occurred_at')
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const candidates = [new Date(createdAt)];
  if (user?.last_sign_in) candidates.push(new Date(user.last_sign_in));
  if (act?.occurred_at) candidates.push(new Date(act.occurred_at));
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

function monthsAgoUTC(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

async function sweepFreeArchive(rows: SubscriptionRow[]): Promise<void> {
  const twelveMonthsAgo = monthsAgoUTC(12);
  const thirteenMonthsAgo = monthsAgoUTC(13);
  const now = new Date();

  for (const row of rows) {
    // Only FREE and only genuinely free: a comped workspace was granted its
    // plan deliberately and is never swept. Already-archived rows are done.
    if (row.plan_id !== 'free' || row.status === 'comped') continue;
    if (!row.workspace || row.workspace.archived_at) continue;

    try {
      const lastActive = await lastActiveAt(row.workspace_id, row.workspace.created_at);

      if (lastActive > twelveMonthsAgo) {
        // Alive. If a warning was stamped in an earlier dormant spell, clear
        // it — the next spell warns afresh instead of archiving unannounced.
        if (row.workspace.archive_warned_at) {
          await adminClient
            .from('workspace')
            .update({ archive_warned_at: null })
            .eq('id', row.workspace_id);
        }
        continue;
      }

      if (!row.workspace.archive_warned_at) {
        // Month 12: warn once, with the export pointer. The stamp is the dedup.
        const archivesOn = new Date(
          Math.max(
            new Date(lastActive).setUTCMonth(lastActive.getUTCMonth() + 13),
            now.getTime() + 30 * DAY_MS,
          ),
        );
        const { error } = await adminClient
          .from('workspace')
          .update({ archive_warned_at: now.toISOString() })
          .eq('id', row.workspace_id)
          .is('archive_warned_at', null); // race-safe: only the first stamp wins
        if (error) {
          console.error('[meters] archive warn stamp failed', error.message);
          continue;
        }
        const recipients = await adminEmails(row.workspace_id);
        const mail = renderInactivityWarningEmail({
          workspaceName: row.workspace.name,
          lastActiveOn: dateLabel(lastActive),
          archivesOn: dateLabel(archivesOn),
        });
        for (const to of recipients) {
          void sendEmail({ to, ...mail }).catch((e) =>
            console.error('[meters] inactivity email failed', row.workspace_id, e),
          );
        }
        console.log(`[meters] inactivity warning: ${row.workspace_id} (last active ${dateLabel(lastActive)})`);
        continue;
      }

      // Month 13 — but never less than 30 days after the warning, so a
      // workspace found long-dead still gets its full month of notice.
      const warnedAt = new Date(row.workspace.archive_warned_at);
      if (lastActive <= thirteenMonthsAgo && now.getTime() - warnedAt.getTime() >= 30 * DAY_MS) {
        await adminClient
          .from('workspace')
          .update({ archived_at: now.toISOString() })
          .eq('id', row.workspace_id)
          .is('archived_at', null);
        console.log(`[meters] archived: ${row.workspace_id} (soft — reactivation is one click)`);
      }
    } catch (e) {
      console.error('[meters] archive sweep failed for', row.workspace_id, e);
    }
  }
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

const SWEEP_EVERY_MS = 55 * 60 * 1000; // ride the 5-min tick, run ~hourly
let lastSweepAt = 0;

/**
 * Called from server.ts's scheduler interval (via routes/billing.ts). Cheap
 * when it declines; roughly hourly when it runs. Everything inside is
 * deduplicated, so overlap with a restart is harmless.
 */
export async function runUsageMeterTick(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now;

  const rows = await allSubscriptions();
  if (rows.length === 0) return;
  await sweepUsageWarnings(rows);
  await sweepOverageBilling(rows);
  await sweepFreeArchive(rows);
}

// ---------------------------------------------------------------------------
// Snapshot for GET /billing/usage (Settings → Plan meters)
// ---------------------------------------------------------------------------

export async function meterSnapshot(workspaceId: string): Promise<{
  emails: {
    used: number;
    included: number | null;
    overage_cents_per_1000: number | null;
    projected_overage_cents: number;
  };
  storage: {
    bytes: number;
    included_gb: number | null;
    overage_cents_per_gb: number | null;
    projected_overage_cents: number;
  };
  warnings: { meter: string; sent_at: string }[];
  archive: { archived_at: string | null; archive_warned_at: string | null };
}> {
  const periodStart = monthStartUTC().toISOString().slice(0, 10);
  const [plan, emailsSent, storage, { data: warned }, { data: ws }] = await Promise.all([
    planFor(workspaceId),
    emailsSentBetween(workspaceId, monthStartUTC()),
    storageUsage(workspaceId),
    adminClient
      .from('usage_warning')
      .select('meter, sent_at')
      .eq('workspace_id', workspaceId)
      .eq('period_start', periodStart),
    adminClient
      .from('workspace')
      .select('archived_at, archive_warned_at')
      .eq('id', workspaceId)
      .maybeSingle(),
  ]);

  const emailOver =
    plan.includedEmailsMonth !== null ? Math.max(0, emailsSent - plan.includedEmailsMonth) : 0;
  const storageOverGb =
    plan.includedStorageGb !== null
      ? Math.max(0, Math.ceil(storage.bytes / GB) - plan.includedStorageGb)
      : 0;

  return {
    emails: {
      used: emailsSent,
      included: plan.includedEmailsMonth,
      overage_cents_per_1000: plan.emailOverageCentsPer1000,
      projected_overage_cents:
        plan.emailOverageCentsPer1000 !== null
          ? Math.round((emailOver * plan.emailOverageCentsPer1000) / 1000)
          : 0,
    },
    storage: {
      bytes: storage.bytes,
      included_gb: plan.includedStorageGb,
      overage_cents_per_gb: plan.storageOverageCentsPerGb,
      projected_overage_cents:
        plan.storageOverageCentsPerGb !== null ? storageOverGb * plan.storageOverageCentsPerGb : 0,
    },
    warnings: (warned ?? []).map((w) => ({ meter: w.meter as string, sent_at: w.sent_at as string })),
    archive: {
      archived_at: ws?.archived_at ?? null,
      archive_warned_at: ws?.archive_warned_at ?? null,
    },
  };
}
