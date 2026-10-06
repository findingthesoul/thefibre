-- Two teams every workspace has without anybody creating them.
--
-- Sjoerd, 2026-10-06, approving docs/teams-two-automatic-teams.md:
--
--   ADMINS   — its members are exactly the workspace's admins. Nobody
--              maintains it; one writer keeps it true.
--   EVERYONE — the default. Every member is in it, and what it grants is what
--              a newcomer gets.
--
-- This migration only makes the two teams NAMEABLE and PROTECTED. Creating
-- them, keeping Admins in sync and converting existing workspaces are the
-- API's job (lib/automatic-teams.ts) — the same split team_app_grant already
-- uses: the table is the intent, the resolver does the work.
--
-- ---------------------------------------------------------------------------
-- Why a column rather than matching on the name
-- ---------------------------------------------------------------------------
-- A workspace can rename its teams, and somebody will: "Everyone" becomes
-- "Alle leden", "Admins" becomes "Kernteam". Identity has to survive that, and
-- a name match would silently stop finding the team the moment it was renamed
-- — which is exactly when protecting it matters most.

alter table public.team
  add column if not exists automatic text
    check (automatic in ('admins', 'everyone'));

comment on column public.team.automatic is
  'Set when this is one of the two teams every workspace has automatically: '
  '''admins'' mirrors workspace_member.workspace_role, ''everyone'' holds every '
  'member and grants the newcomer baseline. NULL for teams people made '
  'themselves. Identity lives here and not in the name, because a workspace '
  'may rename either of them.';

-- One of each per workspace, and no more. Without this a retried creation —
-- or two API instances racing on a new workspace — quietly produces two
-- "Everyone" teams, and a person lands in one of them.
create unique index if not exists team_automatic_uq
  on public.team (workspace_id, automatic)
  where automatic is not null;

-- ---------------------------------------------------------------------------
-- They cannot be deleted
-- ---------------------------------------------------------------------------
-- A workspace without its Everyone team has no answer to "what does a new
-- person get", and a delete would cascade team_member and team_app_grant,
-- taking the baseline with it. Refused in the database rather than in a route,
-- because the route is not the only thing that can issue a delete.
-- A workspace being deleted must still take them with it, so the guard stands
-- down when the workspace itself is going. Without that exception the trigger
-- would make every workspace undeletable, which is a worse bug than the one it
-- prevents: team.workspace_id is ON DELETE CASCADE, and a BEFORE DELETE
-- trigger on the child fires during that cascade. By then the parent row is
-- already gone, which is what the EXISTS below tests — asserted by a test
-- rather than assumed, because row visibility inside a cascade is exactly the
-- kind of thing that is obvious and wrong.
create or replace function public.team_automatic_no_delete()
returns trigger
language plpgsql
as $$
begin
  if old.automatic is not null
     and exists (select 1 from public.workspace w where w.id = old.workspace_id)
  then
    raise exception
      'team % is the workspace''s automatic % team and cannot be deleted', old.id, old.automatic
      using hint = 'Rename it if the wording is wrong; its membership follows the workspace.';
  end if;
  return old;
end;
$$;

comment on function public.team_automatic_no_delete() is
  'Refuses deletion of a workspace''s automatic teams, while allowing the '
  'cascade when the workspace itself is deleted (the row is gone from '
  'public.workspace by the time the child cascade runs).';

drop trigger if exists team_automatic_no_delete on public.team;
create trigger team_automatic_no_delete
  before delete on public.team
  for each row execute function public.team_automatic_no_delete();
