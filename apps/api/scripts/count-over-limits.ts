// How many workspaces are over their plan's limits — a COUNT, not a change.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/count-over-limits.ts            # production
//   npx tsx --env-file=.env.staging scripts/count-over-limits.ts    # staging
//
//   … --all        every workspace, not only the ones over something
//   … --csv        machine-readable, for pasting into a sheet
//
// ---------------------------------------------------------------------------
// It writes NOTHING, and that is the point of it existing first.
// ---------------------------------------------------------------------------
// docs/free-plan-limits-and-meet-tiers.md proposes holding a Free workspace's
// scheduled mail past 200/month. That changes what real customers' events do,
// so the number of workspaces it would touch is not a thing to estimate — it
// is a thing to count, before the behaviour ships, on the database it would
// happen on. If the answer is nobody, the feature is a guard against a future
// problem and can ship quietly. If it is somebody's conference, that is a
// conversation Sjoerd has before the code does it for him.
//
// There is no --apply and no --production flag, because there is nothing to
// gate: every statement below is a select.
//
// ---------------------------------------------------------------------------
// What it counts, and what it deliberately does not
// ---------------------------------------------------------------------------
// EMAILS are `thread_message_send` rows this calendar month — one row per
// (engagement, person), written by the triggered-message scheduler. That is
// the same measure `meterSnapshot` and the warning mails already use, reached
// through the product's own `emailsSentBetween` rather than a second query
// that could drift from it.
//
// Transactional mail — sign-in codes, invoices, booking confirmations — has no
// `thread_message_send` row and is therefore NOT COUNTED HERE and must never
// be. It is not merely "not blocked": it is not measured, so no future
// counting change can quietly make a sign-in code billable. The hold feature
// inherits that boundary by construction, because it holds exactly what this
// counts.
//
// STORAGE and MONTHS SINCE ACTIVITY come along because the proposal asks the
// same question of them, and asking three questions in one pass is one
// production read instead of three.

import { adminClient } from '../src/db.js';
// All four from plan.ts — the product's own measures, not a second set of
// queries that could drift from what the warning mails and Settings → Plan
// already show. (`storageUsage` lives here too, not in usage-meters, which
// imports it from this file.)
import { planFor, emailsSentBetween, monthStartUTC, storageUsage } from '../src/lib/plan.js';

const ALL = process.argv.includes('--all');
const CSV = process.argv.includes('--csv');

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const GB = 1024 * 1024 * 1024;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ref = (() => {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return url;
  }
})();

type Row = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  emails: number;
  emailsIncluded: number | null;
  emailsOver: number;
  storageGb: number;
  storageIncluded: number | null;
  storageOverGb: number;
  monthsIdle: number | null;
  retentionMonths: number | null;
};

async function main(): Promise<void> {
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('REFUSED: no Supabase url/service key in the environment.');
    console.error('Run with: npx tsx --env-file=.env scripts/count-over-limits.ts');
    process.exit(2);
  }
  const name =
    ref === STAGING_REF ? 'STAGING' : ref === PRODUCTION_REF ? 'PRODUCTION' : 'an UNKNOWN project';
  if (!CSV) {
    console.log(`Project: ${ref} (${name})`);
    console.log('This script only reads. It changes nothing, on any database.\n');
  }

  const { data: workspaces, error } = await adminClient
    .from('workspace')
    .select('id, name, slug, archived_at')
    .is('archived_at', null)
    .order('name');
  if (error) {
    console.error(`REFUSED: could not list workspaces: ${error.message}`);
    process.exit(1);
  }
  if (!workspaces?.length) {
    console.error('REFUSED: no workspaces came back. That is not a believable answer — check the env file.');
    process.exit(1);
  }

  const since = monthStartUTC();
  const rows: Row[] = [];
  for (const ws of workspaces) {
    const id = ws.id as string;
    const [plan, emails, storage, lastActivity] = await Promise.all([
      planFor(id),
      emailsSentBetween(id, since),
      storageUsage(id),
      lastActivityAt(id),
    ]);
    const storageGb = storage.bytes / GB;
    rows.push({
      id,
      name: (ws.name as string) ?? '(unnamed)',
      slug: (ws.slug as string | null) ?? null,
      plan: plan.id,
      emails,
      emailsIncluded: plan.includedEmailsMonth,
      emailsOver:
        plan.includedEmailsMonth === null ? 0 : Math.max(0, emails - plan.includedEmailsMonth),
      storageGb,
      storageIncluded: plan.includedStorageGb,
      storageOverGb:
        plan.includedStorageGb === null
          ? 0
          : Math.max(0, Math.ceil(storageGb) - plan.includedStorageGb),
      monthsIdle: lastActivity === null ? null : monthsSince(lastActivity),
      retentionMonths: plan.retentionMonths,
    });
  }

  const over = rows.filter(
    (r) =>
      r.emailsOver > 0 ||
      r.storageOverGb > 0 ||
      (r.retentionMonths !== null && r.monthsIdle !== null && r.monthsIdle >= r.retentionMonths),
  );

  if (CSV) {
    console.log(
      'workspace,slug,plan,emails_this_month,emails_included,emails_over,storage_gb,storage_included_gb,storage_over_gb,months_idle,retention_months',
    );
    for (const r of ALL ? rows : over) {
      console.log(
        [
          JSON.stringify(r.name),
          r.slug ?? '',
          r.plan,
          r.emails,
          r.emailsIncluded ?? '',
          r.emailsOver,
          r.storageGb.toFixed(3),
          r.storageIncluded ?? '',
          r.storageOverGb,
          r.monthsIdle ?? '',
          r.retentionMonths ?? '',
        ].join(','),
      );
    }
    return;
  }

  // The headline the proposal actually asks for.
  const free = rows.filter((r) => r.plan === 'free');
  const freeOverEmails = free.filter((r) => r.emailsOver > 0);
  console.log(`Workspaces (not archived): ${rows.length}   on Free: ${free.length}`);
  console.log(
    `Over their email allowance THIS MONTH: ${rows.filter((r) => r.emailsOver > 0).length}` +
      `   of which on Free: ${freeOverEmails.length}`,
  );
  console.log(`Over their storage allowance: ${rows.filter((r) => r.storageOverGb > 0).length}`);
  console.log(
    `Idle longer than their retention window: ` +
      `${rows.filter((r) => r.retentionMonths !== null && r.monthsIdle !== null && r.monthsIdle >= r.retentionMonths).length}\n`,
  );

  // The month is PART-WAY THROUGH. A workspace at 150 of 200 on the 3rd is a
  // different story from one at 150 on the 28th, and a count that hid that
  // would be read as "nobody is close".
  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  console.log(`(day ${dayOfMonth} of ${daysInMonth} — the month is ${Math.round((dayOfMonth / daysInMonth) * 100)}% through)\n`);

  const shown = ALL ? rows : over;
  if (!shown.length) {
    console.log('Nothing is over any limit today.');
    console.log('For the hold-and-ask feature that means it would hold nobody right now —');
    console.log('it is a guard against a future month, not a change to anybody this one.');
    return;
  }
  for (const r of shown.sort((a, b) => b.emailsOver - a.emailsOver)) {
    const bits = [`${r.name}${r.slug ? ` (${r.slug})` : ''}`, `plan=${r.plan}`];
    bits.push(
      `emails ${r.emails}/${r.emailsIncluded ?? '∞'}${r.emailsOver ? ` — OVER by ${r.emailsOver}` : ''}`,
    );
    if (r.storageIncluded !== null) {
      bits.push(
        `storage ${r.storageGb.toFixed(2)}/${r.storageIncluded}GB${r.storageOverGb ? ` — OVER by ${r.storageOverGb}GB` : ''}`,
      );
    }
    if (r.monthsIdle !== null) bits.push(`idle ${r.monthsIdle}mo`);
    console.log(`  ${bits.join('   ')}`);
  }

  if (!ALL) console.log(`\n(${rows.length - shown.length} within every limit — --all lists them too)`);
}

/** The most recent thing that happened in this workspace, or null if nothing
 *  ever did. `activity` is the append-only event log; its newest row is the
 *  honest answer to "is anybody using this?". */
async function lastActivityAt(workspaceId: string): Promise<Date | null> {
  const { data, error } = await adminClient
    .from('activity')
    .select('occurred_at')
    .eq('workspace_id', workspaceId)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(`[count] activity lookup failed for ${workspaceId}: ${error.message}`);
    return null;
  }
  return data?.occurred_at ? new Date(data.occurred_at as string) : null;
}

function monthsSince(d: Date): number {
  const now = new Date();
  return (
    (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth())
  );
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
