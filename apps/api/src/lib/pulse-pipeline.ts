import { adminClient } from '../db.js';

// ===========================================================================
// The Pipeline is a Fibre Flow; Pulse consumes it (Sjoerd, 2026-07-08).
//
// Flow owns authoring: flow_definition system_key='pulse_pipeline' (steps,
// transitions, canvas). Pulse's pulse_stage is a MIRROR of the current
// version's steps plus the money-semantics overlay (`kind`). This module is
// the single doorway for both directions:
//   - ensurePipelineFlow(): seed the flow + mirror on Pulse activation
//   - syncStagesFromFlow(): refresh the mirror before Pulse reads stages
//
// Cross-app reads run on adminClient (workspace-scoped by hand): a Pulse
// admin isn't necessarily a Flow member, and this crossing is sanctioned at
// the definition level only (proposal §3.12).
// ===========================================================================

const DEFAULT_STEPS = [
  { key: 'lead', name: 'Lead', kind: 'entry', ordinal: 1, x: 80, y: 200 },
  { key: 'proposal', name: 'Proposal', kind: 'normal', ordinal: 2, x: 320, y: 200 },
  { key: 'committed', name: 'Committed', kind: 'normal', ordinal: 3, x: 560, y: 200 },
  { key: 'invoiced', name: 'Invoiced', kind: 'normal', ordinal: 4, x: 800, y: 200 },
  { key: 'done', name: 'Done', kind: 'end_positive', ordinal: 5, x: 1040, y: 200 },
  { key: 'cancelled', name: 'Cancelled', kind: 'end_negative', ordinal: 6, x: 560, y: 420 },
] as const;

// Default money semantics for the seeded keys; flow-authored steps default
// to 'open' (weighted) until an admin sets them in Pulse Settings.
const DEFAULT_KINDS: Record<string, string> = {
  lead: 'open',
  proposal: 'open',
  committed: 'committed',
  invoiced: 'committed', // the receivable state — counts in full
  done: 'won',
  cancelled: 'lost',
};
const DEFAULT_PROBABILITIES: Record<string, number> = {
  lead: 25,
  proposal: 60,
  committed: 100,
  invoiced: 100,
  done: 100,
  cancelled: 0,
};

function stageKindForStep(stepKind: string, existing?: string): string {
  if (stepKind === 'end_positive') return 'won';
  if (stepKind === 'end_negative') return 'lost';
  // entry/normal: keep whatever Pulse's overlay says; default open.
  return existing && existing !== 'won' && existing !== 'lost' ? existing : 'open';
}

export async function ensurePipelineFlow(workspaceId: string, ownerUserId: string): Promise<void> {
  const { data: existing } = await adminClient
    .from('flow_definition')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('system_key', 'pulse_pipeline')
    .maybeSingle();
  if (existing) return;

  const { data: flow, error: fErr } = await adminClient
    .from('flow_definition')
    .insert({
      workspace_id: workspaceId,
      name: 'Pipeline',
      description:
        'The sales pipeline. Fibre Pulse reads this flow: every opportunity in the cashflow sits at one of these steps. Edit the steps here; set their money semantics (weighted/committed) in Pulse → Settings.',
      scope: 'workspace',
      owner_user_id: ownerUserId,
      visibility: 'org_wide',
      lifecycle: 'active',
      created_by: ownerUserId,
      system_key: 'pulse_pipeline',
    })
    .select('id')
    .single();
  if (fErr || !flow) {
    console.error('[pulse-pipeline] flow create failed', fErr);
    return;
  }

  const { data: version, error: vErr } = await adminClient
    .from('flow_version')
    .insert({
      flow_id: flow.id,
      version_number: 1,
      published_at: new Date().toISOString(),
      created_by: ownerUserId,
    })
    .select('id')
    .single();
  if (vErr || !version) {
    console.error('[pulse-pipeline] version create failed', vErr);
    return;
  }
  await adminClient
    .from('flow_definition')
    .update({ current_version_id: version.id })
    .eq('id', flow.id);

  const { data: steps, error: sErr } = await adminClient
    .from('flow_step')
    .insert(
      DEFAULT_STEPS.map((s) => ({
        flow_version_id: version.id,
        key: s.key,
        name: s.name,
        kind: s.kind,
        ordinal: s.ordinal,
        canvas_x: s.x,
        canvas_y: s.y,
      })),
    )
    .select('id, key');
  if (sErr || !steps) {
    console.error('[pulse-pipeline] steps create failed', sErr);
    return;
  }
  const byKey = new Map(steps.map((s) => [s.key, s.id]));
  const t = (from: string, to: string, label: string, ordinal: number) => ({
    flow_version_id: version.id,
    from_step_id: byKey.get(from),
    to_step_id: byKey.get(to),
    label,
    ordinal,
  });
  const { error: tErr } = await adminClient.from('flow_transition').insert([
    t('lead', 'proposal', 'Proposal sent', 1),
    t('proposal', 'committed', 'Committed', 2),
    t('committed', 'invoiced', 'Invoice sent', 3),
    t('invoiced', 'done', 'Paid', 4),
    t('lead', 'cancelled', 'Cancelled', 5),
    t('proposal', 'cancelled', 'Cancelled', 6),
    t('committed', 'cancelled', 'Cancelled', 7),
    t('invoiced', 'cancelled', 'Cancelled', 8),
  ]);
  if (tErr) console.error('[pulse-pipeline] transitions create failed', tErr);

  // Seed the mirror + overlay.
  const { error: mErr } = await adminClient.from('pulse_stage').upsert(
    DEFAULT_STEPS.map((s) => ({
      workspace_id: workspaceId,
      key: s.key,
      label: s.name,
      kind: DEFAULT_KINDS[s.key] ?? 'open',
      default_probability: DEFAULT_PROBABILITIES[s.key] ?? null,
      sort_order: s.ordinal,
      is_system: true,
    })),
    { onConflict: 'workspace_id,key', ignoreDuplicates: true },
  );
  if (mErr) console.error('[pulse-pipeline] stage mirror seed failed', mErr);
}

export type SyncedStages = {
  pipeline_flow_id: string | null;
};

// Refresh pulse_stage from the Pipeline flow's current version. Labels and
// order come from Flow; `kind` (money semantics) is Pulse's overlay and is
// preserved for non-terminal steps. Steps removed from the flow disappear
// from the mirror unless commitments still point at them.
export async function syncStagesFromFlow(workspaceId: string): Promise<SyncedStages> {
  const { data: flow } = await adminClient
    .from('flow_definition')
    .select('id, current_version_id')
    .eq('workspace_id', workspaceId)
    .eq('system_key', 'pulse_pipeline')
    .is('deleted_at', null)
    .maybeSingle();
  if (!flow?.current_version_id) return { pipeline_flow_id: flow?.id ?? null };

  const { data: steps, error: sErr } = await adminClient
    .from('flow_step')
    .select('key, name, kind, ordinal')
    .eq('flow_version_id', flow.current_version_id)
    .order('ordinal', { ascending: true });
  if (sErr || !steps?.length) return { pipeline_flow_id: flow.id };

  const { data: mirror } = await adminClient
    .from('pulse_stage')
    .select('id, key, kind')
    .eq('workspace_id', workspaceId);
  const mirrorByKey = new Map((mirror ?? []).map((m) => [m.key, m]));

  const upserts = steps.map((step, i) => ({
    workspace_id: workspaceId,
    key: step.key,
    label: step.name,
    kind: stageKindForStep(step.kind, mirrorByKey.get(step.key)?.kind),
    sort_order: step.ordinal ?? i + 1,
    is_system: DEFAULT_KINDS[step.key] !== undefined,
  }));
  const { error: uErr } = await adminClient
    .from('pulse_stage')
    .upsert(upserts, { onConflict: 'workspace_id,key' });
  if (uErr) console.error('[pulse-pipeline] mirror upsert failed', uErr);

  // Prune mirror rows whose step vanished from the flow — unless in use.
  const flowKeys = new Set(steps.map((s) => s.key));
  const stale = (mirror ?? []).filter((m) => !flowKeys.has(m.key));
  for (const m of stale) {
    const { count } = await adminClient
      .from('pulse_commitment')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('stage', m.key)
      .is('deleted_at', null);
    if (!count) {
      await adminClient.from('pulse_stage').delete().eq('id', m.id);
    }
  }

  return { pipeline_flow_id: flow.id };
}

// ---------------------------------------------------------------------------
// Runtime bridge (Sjoerd 2026-07-08: opportunities must be visible in FLOW).
// Every Pulse opportunity mirrors to a flow_run on the Pipeline flow
// (source_app='fibre-pulse', source_ref=commitment id — unique per flow).
// Pulse edits move the run; Flow transitions call back into the commitment
// (see flow.ts /runs/:id/transition).
// ---------------------------------------------------------------------------

type CommitmentForRun = {
  id: string;
  workspace_id?: string;
  label: string;
  stage: string;
  person_id: string | null;
  organisation_id: string | null;
  owner_user_id: string | null;
  deleted?: boolean;
};

export async function syncOpportunityRun(
  workspaceId: string,
  cm: CommitmentForRun,
): Promise<void> {
  try {
    const { data: flow } = await adminClient
      .from('flow_definition')
      .select('id, current_version_id')
      .eq('workspace_id', workspaceId)
      .eq('system_key', 'pulse_pipeline')
      .is('deleted_at', null)
      .maybeSingle();
    if (!flow?.current_version_id) return;

    const { data: existing } = await adminClient
      .from('flow_run')
      .select('id, current_step_id, status, deleted_at')
      .eq('flow_id', flow.id)
      .eq('source_app', 'fibre-pulse')
      .eq('source_ref', cm.id)
      .maybeSingle();

    if (cm.deleted) {
      if (existing && !existing.deleted_at) {
        await adminClient
          .from('flow_run')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id);
      }
      return;
    }

    const { data: step } = await adminClient
      .from('flow_step')
      .select('id, kind')
      .eq('flow_version_id', flow.current_version_id)
      .eq('key', cm.stage)
      .maybeSingle();
    if (!step) return; // stage key not (yet) a step of the flow — mirror sync will catch up

    const isEnd = step.kind === 'end_positive' || step.kind === 'end_negative';
    const base = {
      person_id: cm.person_id,
      organisation_id: cm.organisation_id,
      subject_label: cm.label,
      owner_user_id: cm.owner_user_id,
      current_step_id: step.id,
      status: isEnd ? 'completed' : 'active',
      completed_at: isEnd ? new Date().toISOString() : null,
    };

    if (!existing || existing.deleted_at) {
      const { error } = await adminClient.from('flow_run').insert({
        workspace_id: workspaceId,
        flow_id: flow.id,
        flow_version_id: flow.current_version_id,
        source_app: 'fibre-pulse',
        source_ref: cm.id,
        ...base,
      });
      if (error) console.error('[pulse-pipeline] run insert failed', error);
      return;
    }

    const stepChanged = existing.current_step_id !== step.id;
    const { error } = await adminClient
      .from('flow_run')
      .update({
        ...base,
        ...(stepChanged ? { current_step_entered_at: new Date().toISOString() } : {}),
      })
      .eq('id', existing.id);
    if (error) console.error('[pulse-pipeline] run update failed', error);
  } catch (e) {
    console.error('[pulse-pipeline] syncOpportunityRun threw', e);
  }
}

// Idempotent backfill: mirror every live commitment into a run. Called from
// GET /pulse/stages (already the periodic sync point). Fine at current
// scale; batch it when workspaces carry thousands of opportunities.
export async function ensureOpportunityRuns(workspaceId: string): Promise<void> {
  // Cheap parity check first — the O(N) walk only runs when a run is
  // actually missing (write hooks keep them in sync day-to-day). This was
  // the 2-second tax on every stages read (Sjoerd, 2026-07-09 morning).
  const [{ count: cmCount }, { count: runCount }] = await Promise.all([
    adminClient
      .from('pulse_commitment')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null),
    adminClient
      .from('flow_run')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('source_app', 'fibre-pulse')
      .is('deleted_at', null),
  ]);
  if ((cmCount ?? 0) <= (runCount ?? 0)) return;

  const { data: commitments } = await adminClient
    .from('pulse_commitment')
    .select('id, label, stage, person_id, organisation_id, owner_user_id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);
  for (const cm of commitments ?? []) {
    await syncOpportunityRun(workspaceId, cm as CommitmentForRun);
  }
}

// The flow→mirror sync is idempotent but costs ~6 queries; once a minute
// per workspace is plenty (stage edits in Flow surface within 60s; Pulse-
// side kind/probability edits hit the mirror directly anyway).
const lastSyncAt = new Map<string, number>();
export function shouldSyncStages(workspaceId: string): boolean {
  const last = lastSyncAt.get(workspaceId) ?? 0;
  if (Date.now() - last < 60_000) return false;
  lastSyncAt.set(workspaceId, Date.now());
  return true;
}
