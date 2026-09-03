-- ============================================================================
-- New workspaces start ACTIVE on Free — not comped.
--
-- The 20260519 trigger marked every auto-created subscription 'comped'
-- ("auto-created at workspace insert"), from before money was real. Comped
-- deliberately hides all self-serve billing ("on the house" — no buy
-- buttons), so every Signup-v2 customer was born unable to upgrade
-- (Sjoerd, 2026-09-03: "Still no way to upgrade for me as client").
--
-- 'active' on Free is honest: an alive subscription that costs nothing.
-- Comped remains what it always was — a deliberate grant by a super admin.
--
-- (Fresh migration rather than editing 20260519100000: Supabase tracks
-- applied migrations by filename — editing an applied file is a no-op.)
-- ============================================================================

create or replace function public.handle_new_workspace_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_subscription (workspace_id, plan_id, status)
  values (new.id, 'free', 'active')
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

-- Repair the rows the old trigger created (test signups since the gates
-- landed). The deliberately-granted comps — grandfathers, Sjoerd's own
-- workspaces — carry different reasons and are untouched.
update public.workspace_subscription
   set status = 'active',
       comped_reason = null,
       updated_at = now()
 where status = 'comped'
   and comped_reason = 'auto-created at workspace insert';
