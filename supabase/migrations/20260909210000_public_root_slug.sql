-- One public address, one owner (Sjoerd, 2026-09-09).
--
-- app.thethread.app/{owner} resolves a workspace, a team or an organiser
-- from a SINGLE global segment (docs/brief-workspace-urls.md D3). Until
-- today nothing enforced that the segment was unique. Uniqueness existed
-- only INSIDE a workspace and only per table: `workspace.slug` is globally
-- unique, `thread_organiser` is unique per (workspace_id, slug), `team` is
-- unique per workspace through meet_root_slug — and none of them knew about
-- the others.
--
-- What that cost, live, this afternoon: a team called "Vertrouwen als de
-- Basis" was created in the soul.com workspace while a team of the same name
-- already existed in Solidarity Lab. `resolvePublicOwner` looks the slug up
-- with .maybeSingle(), two rows came back, and BOTH teams' public pages —
-- plus the two live threads underneath one of them — started answering 404.
-- Nothing warned anyone at creation time. The failure was silent, remote
-- from its cause, and hit the workspace that had done nothing wrong.
--
-- So the namespace gets a table of its own. One row per publicly addressable
-- owner, slug as the primary key, kept in sync by triggers. A second claim
-- is now a unique violation at the moment of the claim, which the API turns
-- into a 409 the person can act on.
--
-- Not included: meet_host. Meet resolves its own root on a DIFFERENT host
-- (meet.thethread.app), so a Meet host and a Thread organiser sharing a word
-- collide with nothing. `team` appears here because a team is addressable on
-- app.thethread.app, and keeps its existing meet_root_slug row as well.

create table public.public_root_slug (
  -- Lowercased and trimmed by the triggers; this is the URL segment itself.
  slug          text primary key,
  kind          text not null check (kind in ('workspace', 'team', 'organiser')),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  team_id       uuid references public.team(id) on delete cascade,
  organiser_id  uuid references public.thread_organiser(id) on delete cascade,
  created_at    timestamptz not null default now(),
  check (
    (kind = 'workspace' and team_id is null and organiser_id is null) or
    (kind = 'team'      and team_id is not null and organiser_id is null) or
    (kind = 'organiser' and organiser_id is not null and team_id is null)
  )
);
create index public_root_slug_workspace_idx on public.public_root_slug (workspace_id);
create unique index public_root_slug_team_uq on public.public_root_slug (team_id)
  where team_id is not null;
create unique index public_root_slug_organiser_uq on public.public_root_slug (organiser_id)
  where organiser_id is not null;

comment on table public.public_root_slug is
  'The app.thethread.app/{owner} namespace. One row per workspace, team and thread organiser; slug is the primary key, so the second claimant is refused instead of quietly 404ing both. Machine state — service-role only, maintained by triggers.';

-- Service-role-only, like every other machine-state table: RLS on, no
-- policies. Readers go through the API's adminClient. The sync triggers are
-- SECURITY DEFINER so an ordinary authenticated INSERT on `team` can still
-- maintain the row.
alter table public.public_root_slug enable row level security;

-- ---------------------------------------------------------------------------
-- Sync triggers — one per owning table.
-- ---------------------------------------------------------------------------

create or replace function public.sync_workspace_root_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.public_root_slug where workspace_id = old.id and kind = 'workspace';
    return old;
  end if;
  delete from public.public_root_slug where workspace_id = new.id and kind = 'workspace';
  insert into public.public_root_slug (slug, kind, workspace_id)
    values (lower(trim(new.slug)), 'workspace', new.id);
  return new;
end $$;

create or replace function public.sync_team_root_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.public_root_slug where team_id = old.id;
    return old;
  end if;
  delete from public.public_root_slug where team_id = new.id;
  insert into public.public_root_slug (slug, kind, workspace_id, team_id)
    values (lower(trim(new.slug)), 'team', new.workspace_id, new.id);
  return new;
end $$;

create or replace function public.sync_organiser_root_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.public_root_slug where organiser_id = old.id;
    return old;
  end if;
  delete from public.public_root_slug where organiser_id = new.id;
  insert into public.public_root_slug (slug, kind, workspace_id, organiser_id)
    values (lower(trim(new.slug)), 'organiser', new.workspace_id, new.id);
  return new;
end $$;

create trigger workspace_root_slug_sync
  after insert or update of slug or delete on public.workspace
  for each row execute function public.sync_workspace_root_slug();

create trigger team_public_root_slug_sync
  after insert or update of slug or delete on public.team
  for each row execute function public.sync_team_root_slug();

create trigger thread_organiser_root_slug_sync
  after insert or update of slug or delete on public.thread_organiser
  for each row execute function public.sync_organiser_root_slug();

-- ---------------------------------------------------------------------------
-- Backfill, in D3's precedence order: workspaces win, then organisers, then
-- teams (the order resolvePublicOwner already reads them in).
--
-- `on conflict do nothing` rather than a hard failure: a collision that
-- already exists is a data problem for a human to settle, and it must not
-- take the migration — and with it every other change in the release — down
-- on whichever database happens to hold one. A slug skipped here behaves
-- exactly as it does today; `scripts/audit-root-slugs.mjs` lists them.
-- ---------------------------------------------------------------------------
insert into public.public_root_slug (slug, kind, workspace_id)
select lower(trim(slug)), 'workspace', id from public.workspace
on conflict (slug) do nothing;

insert into public.public_root_slug (slug, kind, workspace_id, organiser_id)
select lower(trim(slug)), 'organiser', workspace_id, id from public.thread_organiser
on conflict (slug) do nothing;

insert into public.public_root_slug (slug, kind, workspace_id, team_id)
select lower(trim(slug)), 'team', workspace_id, id from public.team
on conflict (slug) do nothing;
