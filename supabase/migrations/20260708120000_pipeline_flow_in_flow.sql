-- ============================================================================
-- The Pipeline is a Fibre Flow (Sjoerd, 2026-07-08: "FLOW is the other app...
-- there the pipeline should be built. That FLOW could then be used in the
-- CASHFLOW tool, which is in PULSE").
--
-- Flow owns the authoring: the sales pipeline lives as a real flow_definition
-- named "Pipeline" (steps, transitions, visual canvas). Pulse consumes it
-- read-only: pulse_stage becomes a MIRROR of the flow's steps plus Pulse's
-- money-semantics overlay (kind). This is the third sanctioned data-wall
-- crossing (after activity and the purchase ledger): flow definitions are a
-- consumable capability — any in-family app may read them via the API.
--
-- flow_definition.system_key marks app-owned flows: the API refuses to
-- delete/archive them while the owning app is active.
-- ============================================================================

alter table public.flow_definition add column if not exists system_key text;
create unique index if not exists flow_definition_system_key_idx
  on public.flow_definition (workspace_id, system_key)
  where system_key is not null;

-- Backfill: create the Pipeline flow for every workspace with Pulse active.
do $$
declare
  ws record;
  v_owner uuid;
  v_flow uuid;
  v_version uuid;
  v_lead uuid; v_proposal uuid; v_committed uuid; v_done uuid; v_cancelled uuid;
begin
  for ws in
    select w.id as workspace_id
      from public.workspace w
      join public.workspace_app wa on wa.workspace_id = w.id and wa.deactivated_at is null
      join public.app a on a.id = wa.app_id and a.slug = 'fibre-pulse'
     where not exists (
       select 1 from public.flow_definition fd
        where fd.workspace_id = w.id and fd.system_key = 'pulse_pipeline'
     )
  loop
    select u.id into v_owner
      from public."user" u
     where u.workspace_id = ws.workspace_id and u.is_super_admin = true
     order by u.created_at asc
     limit 1;
    if v_owner is null then
      continue; -- no owner candidate; the API seeds on next activation touch
    end if;

    insert into public.flow_definition
      (workspace_id, name, description, scope, owner_user_id, visibility,
       lifecycle, created_by, system_key)
    values
      (ws.workspace_id, 'Pipeline',
       'The sales pipeline. Fibre Pulse reads this flow: every opportunity in the cashflow sits at one of these steps. Edit the steps here; set their money semantics (weighted/committed) in Pulse → Settings.',
       'workspace', v_owner, 'org_wide', 'active', v_owner, 'pulse_pipeline')
    returning id into v_flow;

    insert into public.flow_version (flow_id, version_number, published_at, created_by)
    values (v_flow, 1, now(), v_owner)
    returning id into v_version;

    update public.flow_definition set current_version_id = v_version where id = v_flow;

    insert into public.flow_step (flow_version_id, key, name, kind, ordinal, canvas_x, canvas_y)
    values (v_version, 'lead', 'Lead', 'entry', 1, 80, 200) returning id into v_lead;
    insert into public.flow_step (flow_version_id, key, name, kind, ordinal, canvas_x, canvas_y)
    values (v_version, 'proposal', 'Proposal', 'normal', 2, 320, 200) returning id into v_proposal;
    insert into public.flow_step (flow_version_id, key, name, kind, ordinal, canvas_x, canvas_y)
    values (v_version, 'committed', 'Committed', 'normal', 3, 560, 200) returning id into v_committed;
    insert into public.flow_step (flow_version_id, key, name, kind, ordinal, canvas_x, canvas_y)
    values (v_version, 'done', 'Done', 'end_positive', 4, 800, 200) returning id into v_done;
    insert into public.flow_step (flow_version_id, key, name, kind, ordinal, canvas_x, canvas_y)
    values (v_version, 'cancelled', 'Cancelled', 'end_negative', 5, 560, 420) returning id into v_cancelled;

    insert into public.flow_transition (flow_version_id, from_step_id, to_step_id, label, ordinal) values
      (v_version, v_lead,      v_proposal,  'Proposal sent', 1),
      (v_version, v_proposal,  v_committed, 'Committed',     2),
      (v_version, v_committed, v_done,      'Done',          3),
      (v_version, v_lead,      v_cancelled, 'Cancelled',     4),
      (v_version, v_proposal,  v_cancelled, 'Cancelled',     5),
      (v_version, v_committed, v_cancelled, 'Cancelled',     6);
  end loop;
end $$;
