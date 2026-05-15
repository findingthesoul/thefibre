-- Fibre Meet — Teams (Step 6, phase 1).
--
-- Adds the concept of a Team: a named, slugged grouping that owns a set of
-- meeting types and has a member list. A meeting type can either be PERSONAL
-- (owned by a host, lives at /<host-slug>/<mt-slug>) or TEAM-OWNED (lives at
-- /<team-slug>/<mt-slug>). Phase 1 keeps the existing one-on-one event type;
-- round-robin / collective land in phase 2.
--
-- Slug namespace is shared at the workspace root: a workspace cannot have a
-- team slug equal to any host slug. Enforced by a single uniqueness table
-- (meet_root_slug) populated via triggers — RLS-safe, no app-layer race.

-- ---------------------------------------------------------------------------
-- meet_team
-- ---------------------------------------------------------------------------
create table public.meet_team (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  slug          text not null,
  name          text not null,
  description   text,
  is_active     boolean not null default true,
  created_by    uuid references public."user"(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index meet_team_workspace_idx on public.meet_team (workspace_id);

-- ---------------------------------------------------------------------------
-- meet_team_member
-- A team has many users in two roles: 'lead' (can edit) and 'member' (visible,
-- bookable as collective/round-robin host once those land).
-- ---------------------------------------------------------------------------
create table public.meet_team_member (
  team_id    uuid not null references public.meet_team(id) on delete cascade,
  user_id    uuid not null references public."user"(id) on delete cascade,
  role       text not null default 'member'
               check (role in ('lead','member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index meet_team_member_user_idx on public.meet_team_member (user_id);

-- ---------------------------------------------------------------------------
-- Meeting types learn about teams.
-- A meeting type belongs to EITHER a host (personal) or a team (team-owned).
-- host_id stays non-null for now — even on a team meeting type it points to
-- the single host that runs the booking. Round-robin in phase 2 will relax
-- that via a separate meet_meeting_type_assignee table.
-- ---------------------------------------------------------------------------
alter table public.meet_meeting_type
  add column team_id uuid references public.meet_team(id) on delete cascade;
create index meet_meeting_type_team_idx on public.meet_meeting_type (team_id)
  where team_id is not null;

-- Slug uniqueness: per-team OR per-host (mutually exclusive). Drop the old
-- single-namespace unique and replace with two partial indexes.
alter table public.meet_meeting_type drop constraint meet_meeting_type_host_id_slug_key;
create unique index meet_meeting_type_host_slug_uq
  on public.meet_meeting_type (host_id, slug)
  where team_id is null;
create unique index meet_meeting_type_team_slug_uq
  on public.meet_meeting_type (team_id, slug)
  where team_id is not null;

-- ---------------------------------------------------------------------------
-- meet_root_slug — shared root-namespace for host slugs and team slugs.
-- One row per host / team, kept in sync by triggers. RLS-readable so the
-- public booking-page can resolve /<slug> to the right entity in one query.
-- ---------------------------------------------------------------------------
create table public.meet_root_slug (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  slug         text not null,
  kind         text not null check (kind in ('host','team')),
  host_id      uuid references public.meet_host(id) on delete cascade,
  team_id      uuid references public.meet_team(id) on delete cascade,
  primary key (workspace_id, slug),
  check (
    (kind = 'host' and host_id is not null and team_id is null) or
    (kind = 'team' and team_id is not null and host_id is null)
  )
);
create index meet_root_slug_host_idx on public.meet_root_slug (host_id) where host_id is not null;
create index meet_root_slug_team_idx on public.meet_root_slug (team_id) where team_id is not null;

-- Triggers: keep meet_root_slug in sync with meet_host and meet_team.
create or replace function public.meet_sync_host_root_slug()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.meet_root_slug (workspace_id, slug, kind, host_id)
      values (new.workspace_id, new.slug, 'host', new.id);
  elsif tg_op = 'UPDATE' then
    if new.slug is distinct from old.slug or new.workspace_id is distinct from old.workspace_id then
      delete from public.meet_root_slug where host_id = new.id;
      insert into public.meet_root_slug (workspace_id, slug, kind, host_id)
        values (new.workspace_id, new.slug, 'host', new.id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.meet_sync_team_root_slug()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.meet_root_slug (workspace_id, slug, kind, team_id)
      values (new.workspace_id, new.slug, 'team', new.id);
  elsif tg_op = 'UPDATE' then
    if new.slug is distinct from old.slug or new.workspace_id is distinct from old.workspace_id then
      delete from public.meet_root_slug where team_id = new.id;
      insert into public.meet_root_slug (workspace_id, slug, kind, team_id)
        values (new.workspace_id, new.slug, 'team', new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger meet_host_root_slug_sync
  after insert or update on public.meet_host
  for each row execute function public.meet_sync_host_root_slug();

create trigger meet_team_root_slug_sync
  after insert or update on public.meet_team
  for each row execute function public.meet_sync_team_root_slug();

-- Backfill: every existing host gets a row in meet_root_slug.
insert into public.meet_root_slug (workspace_id, slug, kind, host_id)
  select workspace_id, slug, 'host', id from public.meet_host
  on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.meet_team        enable row level security;
alter table public.meet_team_member enable row level security;
alter table public.meet_root_slug   enable row level security;

create policy meet_team_scope on public.meet_team
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

-- Team membership: visible to everyone in the workspace with fibre-meet;
-- only the team's leads (or platform admin via service_role) can mutate.
create policy meet_team_member_read on public.meet_team_member
  for select to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1 from public.meet_team t
      where t.id = meet_team_member.team_id
        and t.workspace_id = public.current_workspace_id()
    )
  );

create policy meet_team_member_write on public.meet_team_member
  for all to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1
      from public.meet_team t
      join public.meet_team_member tm on tm.team_id = t.id
      where t.id = meet_team_member.team_id
        and t.workspace_id = public.current_workspace_id()
        and tm.user_id = public.current_user_id()
        and tm.role = 'lead'
    )
  )
  with check (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1
      from public.meet_team t
      join public.meet_team_member tm on tm.team_id = t.id
      where t.id = meet_team_member.team_id
        and t.workspace_id = public.current_workspace_id()
        and tm.user_id = public.current_user_id()
        and tm.role = 'lead'
    )
  );

-- Root slug is readable workspace-wide (no fibre-meet gate — the public
-- booking page uses adminClient anyway; this is for authenticated lookups).
create policy meet_root_slug_read on public.meet_root_slug
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- updated_at trigger for meet_team.
-- ---------------------------------------------------------------------------
create trigger meet_team_updated_at
  before update on public.meet_team
  for each row execute function public.set_updated_at();
