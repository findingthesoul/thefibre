-- ============================================================================
-- Sjoerd 2026-07-08: "Something can be an opportunity (lead, proposal,
-- committed, done, cancelled or an invoice). It would be good if the
-- probability is in settings and is manageable/alterable per row."
--
-- 1. pulse_stage.default_probability — the per-stage default applied when a
--    row enters the stage (row-level probability remains overridable).
-- 2. An "Invoiced" step joins the default sales flow: committed → invoiced →
--    done. kind=committed in the money overlay (counts in full; it's the
--    receivable state; the per-line invoice_ref stays the document link).
-- ============================================================================

alter table public.pulse_stage
  add column if not exists default_probability int
    check (default_probability between 0 and 100);

-- Sensible defaults for the seeded flow (custom stages stay null = keep row).
update public.pulse_stage set default_probability = 25  where key = 'lead'      and default_probability is null;
update public.pulse_stage set default_probability = 60  where key = 'proposal'  and default_probability is null;
update public.pulse_stage set default_probability = 100 where key = 'committed' and default_probability is null;
update public.pulse_stage set default_probability = 100 where key = 'done'      and default_probability is null;
update public.pulse_stage set default_probability = 0   where key = 'cancelled' and default_probability is null;

-- Insert the Invoiced step into every existing Pipeline flow (idempotent).
do $$
declare
  f record;
  v_committed uuid; v_done uuid; v_cancelled uuid; v_invoiced uuid;
begin
  for f in
    select fd.id as flow_id, fd.current_version_id as version_id, fd.workspace_id
      from public.flow_definition fd
     where fd.system_key = 'pulse_pipeline'
       and fd.current_version_id is not null
       and fd.deleted_at is null
       and not exists (
         select 1 from public.flow_step s
          where s.flow_version_id = fd.current_version_id and s.key = 'invoiced'
       )
  loop
    select id into v_committed from public.flow_step
     where flow_version_id = f.version_id and key = 'committed';
    select id into v_done from public.flow_step
     where flow_version_id = f.version_id and key = 'done';
    select id into v_cancelled from public.flow_step
     where flow_version_id = f.version_id and key = 'cancelled';
    if v_committed is null or v_done is null then continue; end if;

    -- Make room: done shifts right on the canvas and in ordinal.
    update public.flow_step set ordinal = ordinal + 1
     where flow_version_id = f.version_id and ordinal >= 4;

    insert into public.flow_step
      (flow_version_id, key, name, kind, ordinal, canvas_x, canvas_y)
    values (f.version_id, 'invoiced', 'Invoiced', 'normal', 4, 800, 200)
    returning id into v_invoiced;
    update public.flow_step set canvas_x = 1040
     where flow_version_id = f.version_id and key = 'done';

    -- Rewire: committed → invoiced → done (+ invoiced → cancelled).
    delete from public.flow_transition
     where flow_version_id = f.version_id
       and from_step_id = v_committed and to_step_id = v_done;
    insert into public.flow_transition (flow_version_id, from_step_id, to_step_id, label, ordinal)
    values
      (f.version_id, v_committed, v_invoiced, 'Invoice sent', 3),
      (f.version_id, v_invoiced,  v_done,     'Paid',         4);
    if v_cancelled is not null then
      insert into public.flow_transition (flow_version_id, from_step_id, to_step_id, label, ordinal)
      values (f.version_id, v_invoiced, v_cancelled, 'Cancelled', 7);
    end if;

    -- Mirror row with money semantics: a sent invoice counts in full.
    insert into public.pulse_stage
      (workspace_id, key, label, kind, sort_order, is_system, default_probability)
    values (f.workspace_id, 'invoiced', 'Invoiced', 'committed', 4, true, 100)
    on conflict (workspace_id, key) do nothing;
    update public.pulse_stage set sort_order = sort_order + 1
     where workspace_id = f.workspace_id and key in ('done','cancelled');
  end loop;
end $$;
