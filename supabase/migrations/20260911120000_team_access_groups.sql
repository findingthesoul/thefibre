-- ============================================================================
-- Teams as access groups (Sjoerd, 2026-09-11).
--
-- "I'm adding more apps and I don't want every app available to everyone in a
-- workspace." The admin already creates teams; those same teams now decide
-- which apps their members may open. No new grouping concept — `team` has
-- been a platform primitive since 20260517220000, it is workspace-scoped, it
-- has members, and team_member.role (lead | member) already carries the
-- distinction app_membership.role needs.
--
-- Nothing about ENFORCEMENT changes. workspace_app still says what a
-- workspace runs and app_membership still says what a user may open. This is
-- an assignment layer that writes the same grant rows a human ticks by hand
-- on the Members page today.
--
-- See docs/teams-as-access-groups-proposal.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. is_published — an internal team has no public page.
--
-- team.slug is a PUBLIC address: team threads live under it and
-- public_root_slug (20260909210000) claims the segment globally. Creating a
-- "Finance" team to let the bookkeeper into Pulse would otherwise also stand
-- up a public-facing team page, which is a surprising side effect for what
-- was meant as an internal permission.
--
-- The slug is still claimed either way (Sjoerd: "when creating it, published
-- or not, it claims that slug... this way we prevent future collisions"), so
-- an internal team can be published later without colliding. That needs no
-- work here: the public_root_slug triggers already fire for every team row.
--
-- Existing teams default to published and keep their slugs untouched.
-- ---------------------------------------------------------------------------
alter table public.team
  add column if not exists is_published boolean not null default true;

comment on column public.team.is_published is
  'Whether the team has a public page at app.thethread.app/{slug}. False = an internal access group. The slug is claimed in public_root_slug either way, so publishing later cannot collide.';

-- ---------------------------------------------------------------------------
-- 2. team_app_grant — which apps a team confers.
--
-- The grant row is about the APP. Whether a particular person gets app-admin
-- is read from their standing in the team (team_member.role = 'lead') at
-- resolution time, so moving someone to lead does not mean rewriting grants.
-- ---------------------------------------------------------------------------
create table if not exists public.team_app_grant (
  team_id           uuid not null references public.team(id) on delete cascade,
  app_id            uuid not null references public.app(id)  on delete cascade,
  lead_is_app_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid references public."user"(id),
  primary key (team_id, app_id)
);
create index if not exists team_app_grant_app_idx on public.team_app_grant (app_id);

comment on table public.team_app_grant is
  'Teams as access groups: every active member of the team holds app_membership for these apps. Resolved into app_membership rows by the API (lib/team-grants.ts) — this table is the intent, app_membership stays the enforcement point.';

alter table public.team_app_grant enable row level security;

-- Read: any workspace member, so the Members page can show WHY somebody has
-- an app without the reader needing admin.
create policy team_app_grant_read on public.team_app_grant
  for select to authenticated
  using (
    exists (
      select 1 from public.team t
       where t.id = team_app_grant.team_id
         and t.workspace_id = public.current_workspace_id()
    )
  );

-- Write: workspace admin only (Sjoerd, 2026-09-11 — "workspace admin only").
-- A team lead runs the team's work; they do not hand out apps.
create policy team_app_grant_write on public.team_app_grant
  for all to authenticated
  using (
    public.is_workspace_admin()
    and exists (
      select 1 from public.team t
       where t.id = team_app_grant.team_id
         and t.workspace_id = public.current_workspace_id()
    )
  )
  with check (
    public.is_workspace_admin()
    and exists (
      select 1 from public.team t
       where t.id = team_app_grant.team_id
         and t.workspace_id = public.current_workspace_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. A workspace admin can manage team MEMBERSHIP.
--
-- team_member insert/update/delete (20260515030000) require
-- has_app_membership('fibre-meet') AND being a lead of that specific team.
-- Both were right when a team was a Meet rota. Neither survives teams being
-- the access grouping: an admin putting the bookkeeper into "Finance" is
-- typically not a lead of it, and may hold no Meet seat at all.
--
-- The lead path is kept exactly as it was. Admin is added alongside it.
--
-- (team READ was already widened to the whole workspace in 20260707210000 —
-- the Meet circularity people remember is gone from the read path.)
-- ---------------------------------------------------------------------------
drop policy if exists meet_team_member_insert on public.team_member;
drop policy if exists meet_team_member_update on public.team_member;
drop policy if exists meet_team_member_delete on public.team_member;
drop policy if exists team_member_insert on public.team_member;
drop policy if exists team_member_update on public.team_member;
drop policy if exists team_member_delete on public.team_member;

create policy team_member_insert on public.team_member
  for insert to authenticated
  with check (
    (
      public.is_workspace_admin()
      and exists (
        select 1 from public.team t
         where t.id = team_member.team_id
           and t.workspace_id = public.current_workspace_id()
      )
    )
    or (public.has_app_membership('fibre-meet') and public.meet_is_team_lead(team_id))
  );

create policy team_member_update on public.team_member
  for update to authenticated
  using (
    (
      public.is_workspace_admin()
      and exists (
        select 1 from public.team t
         where t.id = team_member.team_id
           and t.workspace_id = public.current_workspace_id()
      )
    )
    or (public.has_app_membership('fibre-meet') and public.meet_is_team_lead(team_id))
  )
  with check (
    (
      public.is_workspace_admin()
      and exists (
        select 1 from public.team t
         where t.id = team_member.team_id
           and t.workspace_id = public.current_workspace_id()
      )
    )
    or (public.has_app_membership('fibre-meet') and public.meet_is_team_lead(team_id))
  );

create policy team_member_delete on public.team_member
  for delete to authenticated
  using (
    (
      public.is_workspace_admin()
      and exists (
        select 1 from public.team t
         where t.id = team_member.team_id
           and t.workspace_id = public.current_workspace_id()
      )
    )
    or (public.has_app_membership('fibre-meet') and public.meet_is_team_lead(team_id))
  );

-- An admin who is not a Meet member must also be able to create and rename a
-- team. team_write already allows is_workspace_admin() (20260707210000), so
-- nothing to do there.

-- ---------------------------------------------------------------------------
-- 4. app_membership learns where a grant came from.
--
-- Without this, removing an app from a team cannot tell whether the person
-- also holds it because an admin ticked the box on their member row. One row
-- can be owed to both at once, so this is a flag on the row rather than a
-- source enum: `is_direct` means an admin granted it on the Members page.
--
-- Every existing row is a direct grant — that is the only way one could have
-- been made until today — so the default preserves current behaviour exactly.
-- A row that ends up neither direct nor conferred by a team is deleted by the
-- resolver.
-- ---------------------------------------------------------------------------
alter table public.app_membership
  add column if not exists is_direct boolean not null default true;

comment on column public.app_membership.is_direct is
  'True when an admin granted this app on the Members page. False when the row exists only because a team the user belongs to confers the app. Maintained by lib/team-grants.ts; never set by hand.';
