// The nightly hygiene sweep.
//
// docs/connections-data-integrity.md §9.3, from Sjoerd: *"how do we keep the
// data clean? Can we make a procedure to clean up the database regularly —
// auto, with AI support maybe?"*
//
// §9.1 answered the AI half: the large majority of what goes wrong here is
// detectable with SQL — exactly, cheaply, repeatably, and with an audit
// trail. A language model is slower, costs money, answers differently on
// different runs and cannot be explained to a regulator. So this is a
// scheduled query, and AI stays out of it.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// IT PRODUCES A REVIEW QUEUE. IT DOES NOT SILENTLY REPAIR. A sweep that
// rewrites a workspace's records at 3am is indistinguishable from corruption
// the morning somebody notices. The only exception is the narrow class of
// fixes that are provably safe AND reversible, and even those are recorded as
// rows — "we changed your data and told nobody" is what the queue exists to
// prevent.
//
// NEVER, not even as a proposal: filling in a blank. Cleaning removes
// wrongness; it does not invent completeness.
//
// ── Wiring ──────────────────────────────────────────────────────────────────
//
// A fourth job on the five-minute interval that already exists in server.ts,
// alongside the Thread scheduler, the membership scheduler and the billing
// meters. No new infrastructure (§9.3).
//
// The nightly guard is PERSISTED, unlike the billing meters' in-memory one.
// That is not a style choice: this repo deploys several times a day, an
// in-memory guard resets on every deploy, and a "nightly" sweep would then
// run on every deploy. The stamp lives in hygiene_run.

import { adminClient } from '../db.js';

const HOUR_MS = 60 * 60 * 1000;

/** How often the sweep may run. Slightly under a day so it does not drift
 *  later and later past whatever hour it first ran at. */
const EVERY_MS = 23 * HOUR_MS;

/** Per workspace, per kind. A workspace with four hundred duplicates has a
 *  problem no queue can absorb; the cap keeps the queue readable and the
 *  number is visible in the run log either way. */
const MAX_PER_KIND = 50;

/**
 * A draft nobody came back to. §7.1: autosave means a row exists from the
 * first keystroke, so an abandoned composer leaves an empty draft behind.
 * Fourteen days is well past "I got interrupted" and well short of anything
 * somebody would miss.
 */
const DRAFT_AGE_DAYS = 14;

/** A flow run sitting at the same step with nothing to do. */
const STRANDED_DAYS = 365;

type Finding = {
  workspace_id: string;
  run_id: string;
  kind: string;
  subject_table: string;
  subject_id: string;
  related_id?: string | null;
  evidence: Record<string, unknown>;
  status?: string;
};

/**
 * Upsert findings, ignoring ones already raised.
 *
 * `ignoreDuplicates` against `hygiene_finding_uniq` is what makes re-running
 * safe AND what makes a dismissal stick: a finding somebody said no to is
 * still a row, so the next sweep collides with it and does not re-raise it.
 * A queue that keeps proposing what you already refused is one people stop
 * opening.
 */
async function record(rows: Finding[]): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await adminClient
    .from('hygiene_finding')
    .upsert(rows, {
      onConflict: 'workspace_id,kind,subject_id,related_id',
      ignoreDuplicates: true,
    });
  if (error) {
    console.warn('[hygiene] recording findings failed', error.message);
    return 0;
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// PROPOSE — never applied, always a person's decision.
// ---------------------------------------------------------------------------

/**
 * Duplicate people. The one place §9.4 says AI could eventually help, and
 * deliberately not using it: `person_duplicate_candidates()` already does the
 * deterministic and trigram passes, which catch the easy majority. Escalating
 * only genuine ambiguity to a model is the design, and it needs a
 * sub-processor decision first (§9.5).
 *
 * Never auto-merged. An auto-merge that is wrong produces a worse class of
 * dirt than the duplicate did: two people fused into one, with no trace of
 * which fields came from where.
 */
async function findDuplicates(workspaceId: string, runId: string): Promise<Finding[]> {
  const { data, error } = await adminClient.rpc('person_duplicate_candidates', {
    p_workspace: workspaceId,
    p_limit: MAX_PER_KIND,
  });
  if (error) {
    console.warn('[hygiene] duplicate scan failed', error.message);
    return [];
  }
  return ((data ?? []) as { person_a: string; person_b: string; reason: string; score: number }[])
    .map((d) => ({
      workspace_id: workspaceId,
      run_id: runId,
      kind: 'duplicate_person',
      subject_table: 'person',
      subject_id: d.person_a,
      related_id: d.person_b,
      evidence: { reason: d.reason, score: d.score },
    }));
}

/**
 * A person created by some booking flow, holding an email and nothing else,
 * never touched since. Not deletable — it may be the only record of somebody
 * real — but worth surfacing, because a workspace full of these is a workspace
 * whose numbers mean less than they appear to.
 */
async function findGhosts(workspaceId: string, runId: string): Promise<Finding[]> {
  const { data, error } = await adminClient
    .from('person')
    .select('id, email, first_name, last_name, created_at, created_via')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('merged_into', null)
    .is('first_name', null)
    .is('last_name', null)
    .not('email', 'is', null)
    .lt('created_at', new Date(Date.now() - 90 * 24 * HOUR_MS).toISOString())
    .limit(MAX_PER_KIND);
  if (error) {
    console.warn('[hygiene] ghost scan failed', error.message);
    return [];
  }

  const ids = (data ?? []).map((p) => p.id as string);
  if (!ids.length) return [];

  // "Never touched since" has to be asked of activity, not assumed from the
  // person row — a person with no name may still be very much in the life of
  // the community.
  const { data: touched } = await adminClient
    .from('activity')
    .select('person_id')
    .eq('workspace_id', workspaceId)
    .in('person_id', ids);
  const hasActivity = new Set((touched ?? []).map((a) => a.person_id as string));

  return (data ?? [])
    .filter((p) => !hasActivity.has(p.id as string))
    .map((p) => ({
      workspace_id: workspaceId,
      run_id: runId,
      kind: 'ghost_record',
      subject_table: 'person',
      subject_id: p.id as string,
      evidence: {
        email: p.email,
        created_at: p.created_at,
        created_via: p.created_via ?? null,
        note: 'no name, no activity',
      },
    }));
}

/**
 * Somebody sitting at the same flow step for a year with no open task. Either
 * the flow needs finishing or the person needs withdrawing; either way a
 * human decides, because closing a run silently loses the fact that it was
 * ever open.
 */
async function findStrandedRuns(workspaceId: string, runId: string): Promise<Finding[]> {
  const cutoff = new Date(Date.now() - STRANDED_DAYS * 24 * HOUR_MS).toISOString();
  const { data, error } = await adminClient
    .from('flow_run')
    .select('id, person_id, current_step_entered_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .lt('current_step_entered_at', cutoff)
    .limit(MAX_PER_KIND);
  if (error) {
    console.warn('[hygiene] stranded scan failed', error.message);
    return [];
  }
  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length) return [];

  const { data: tasks } = await adminClient
    .from('flow_task')
    .select('flow_run_id')
    .in('flow_run_id', ids)
    .in('status', ['open', 'in_progress']);
  const busy = new Set((tasks ?? []).map((t) => t.flow_run_id as string));

  return (data ?? [])
    .filter((r) => !busy.has(r.id as string))
    .map((r) => ({
      workspace_id: workspaceId,
      run_id: runId,
      kind: 'stranded_run',
      subject_table: 'flow_run',
      subject_id: r.id as string,
      related_id: (r.person_id as string) ?? null,
      evidence: { at_step_since: r.current_step_entered_at, note: 'no open task' },
    }));
}

// ---------------------------------------------------------------------------
// AUTO-FIX — provably safe, reversible, and still recorded.
// ---------------------------------------------------------------------------

/**
 * Whitespace and case in email addresses.
 *
 * Safe because the local part's case is preserved by every mail system in
 * practice and the domain is case-insensitive by specification, and because
 * every match in this codebase already folds case — `normaliseEmail()` in
 * resolve-person.ts is the single definition. An address stored with a
 * trailing space is not a different person, it is the same person the matcher
 * will miss.
 *
 * Recorded with the value BEFORE the change, which is what makes it
 * reversible by hand if anybody ever disagrees.
 */
async function fixEmailFormatting(workspaceId: string, runId: string): Promise<Finding[]> {
  const { data, error } = await adminClient
    .from('person')
    .select('id, email')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .not('email', 'is', null)
    .limit(1000);
  if (error) {
    console.warn('[hygiene] email scan failed', error.message);
    return [];
  }

  const out: Finding[] = [];
  for (const p of data ?? []) {
    const before = p.email as string;
    const after = before.trim().toLowerCase();
    if (after === before || !after) continue;

    const { error: uErr } = await adminClient
      .from('person')
      .update({ email: after })
      .eq('id', p.id as string);
    if (uErr) {
      // A collision with an existing row is the interesting failure, and it
      // is really a duplicate: two people whose addresses differ only by case.
      // Left for the duplicate scan rather than forced through here.
      console.warn('[hygiene] email fix skipped', uErr.message);
      continue;
    }
    out.push({
      workspace_id: workspaceId,
      run_id: runId,
      kind: 'email_formatting',
      subject_table: 'person',
      subject_id: p.id as string,
      evidence: { before, after },
      status: 'fixed',
    });
  }
  return out;
}

/**
 * Empty drafts nobody came back to. Soft-deleted, never hard — soft delete is
 * a hard rule (brief §13) and an empty draft is still somebody's row.
 *
 * Only rows with NO body and NO follow-up: a draft with text in it is
 * unfinished writing, not litter, and ageing that out would delete the one
 * thing in this product that cannot be derived from anything else.
 */
async function ageOutEmptyDrafts(workspaceId: string, runId: string): Promise<Finding[]> {
  const cutoff = new Date(Date.now() - DRAFT_AGE_DAYS * 24 * HOUR_MS).toISOString();
  const { data, error } = await adminClient
    .from('flow_run_note')
    .select('id, person_id, created_at')
    .eq('workspace_id', workspaceId)
    .eq('is_draft', true)
    .is('deleted_at', null)
    .is('follow_up_at', null)
    .or('body.is.null,body.eq.')
    .lt('created_at', cutoff)
    .limit(MAX_PER_KIND);
  if (error) {
    console.warn('[hygiene] draft scan failed', error.message);
    return [];
  }
  if (!data?.length) return [];

  const ids = data.map((n) => n.id as string);
  const { error: dErr } = await adminClient
    .from('flow_run_note')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (dErr) {
    console.warn('[hygiene] draft age-out failed', dErr.message);
    return [];
  }

  return data.map((n) => ({
    workspace_id: workspaceId,
    run_id: runId,
    kind: 'empty_draft',
    subject_table: 'flow_run_note',
    subject_id: n.id as string,
    related_id: (n.person_id as string) ?? null,
    evidence: { created_at: n.created_at, note: 'empty draft, soft-deleted' },
    status: 'fixed',
  }));
}

// ---------------------------------------------------------------------------
// The tick.
// ---------------------------------------------------------------------------

/** Has a sweep finished within the window? Persisted, so a deploy does not
 *  reset it. */
async function dueForSweep(): Promise<boolean> {
  const { data, error } = await adminClient
    .from('hygiene_run')
    .select('started_at')
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) {
    // Unreadable guard means unknown state. Declining is the safe answer: a
    // missed night costs nothing, a sweep every five minutes costs a lot.
    console.warn('[hygiene] guard read failed, skipping', error.message);
    return false;
  }
  const last = data?.[0]?.started_at as string | undefined;
  return !last || Date.now() - new Date(last).getTime() >= EVERY_MS;
}

/**
 * Called from server.ts's five-minute interval. Cheap when it declines.
 *
 * Every workspace in one pass. The checks are all indexed reads over one
 * workspace at a time, and the whole thing runs once a day, so there is no
 * reason to shard it until a run starts taking minutes — at which point the
 * run log will say so, which is half of why the run log exists.
 */
export async function runHygieneSweep(): Promise<void> {
  if (!(await dueForSweep())) return;

  const { data: run, error: runErr } = await adminClient
    .from('hygiene_run')
    .insert({})
    .select('id')
    .single();
  if (runErr || !run) {
    console.warn('[hygiene] could not start a run', runErr?.message);
    return;
  }
  const runId = run.id as string;

  let found = 0;
  let fixed = 0;
  let workspaces = 0;
  let failure: string | null = null;

  try {
    const { data: ws } = await adminClient
      .from('workspace')
      .select('id')
      .is('archived_at', null);

    for (const w of ws ?? []) {
      const id = w.id as string;
      workspaces += 1;

      // Auto-fixes first, so the proposals that follow see the tidied data —
      // two addresses differing only by case become one obvious duplicate
      // rather than two near-misses.
      const fixes = [
        ...(await fixEmailFormatting(id, runId)),
        ...(await ageOutEmptyDrafts(id, runId)),
      ];
      fixed += await record(fixes);

      const proposals = [
        ...(await findDuplicates(id, runId)),
        ...(await findGhosts(id, runId)),
        ...(await findStrandedRuns(id, runId)),
      ];
      found += await record(proposals);
    }
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
    console.error('[hygiene] sweep threw', e);
  }

  await adminClient
    .from('hygiene_run')
    .update({
      finished_at: new Date().toISOString(),
      workspaces,
      found,
      fixed,
      error: failure,
    })
    .eq('id', runId);
}
