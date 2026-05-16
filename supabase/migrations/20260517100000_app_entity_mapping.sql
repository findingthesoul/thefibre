-- ============================================================================
-- Cross-app entity mapping (docs/cross-app-entity-mapping.md)
--
-- Two new tables formalise how third-party (and our own) apps map their
-- entities to The Fibre's canonical person / organisation / user:
--
--   app_entity_mapping   — per-workspace, per-app declaration: "my X is a
--                          Fibre Y". Written at app install time from the
--                          app's manifest.
--   app_record_link      — per-record links: "this HubSpot contact 12345 is
--                          this Fibre person <uuid>". Written at runtime
--                          when an app syncs or creates a record.
-- ============================================================================

create table public.app_entity_mapping (
  workspace_id     uuid not null references public.workspace(id) on delete cascade,
  app_id           uuid not null references public.app(id) on delete cascade,
  app_entity       text not null,             -- e.g. 'hubspot_contact'
  platform_entity  text not null
                     check (platform_entity in ('person','organisation','user','activity')),
  mapping_kind     text not null
                     check (mapping_kind in ('identity','curator_data','reference')),
  match_on         text[],                    -- field names to match on (e.g. ['email'])
  registered_at    timestamptz not null default now(),
  primary key (workspace_id, app_id, app_entity)
);
create index app_entity_mapping_app_idx       on public.app_entity_mapping (app_id);
create index app_entity_mapping_workspace_idx on public.app_entity_mapping (workspace_id);

create table public.app_record_link (
  workspace_id     uuid not null references public.workspace(id) on delete cascade,
  app_id           uuid not null references public.app(id) on delete cascade,
  app_entity       text not null,
  app_record_id    text not null,             -- the app's own id, as a string
  platform_entity  text not null
                     check (platform_entity in ('person','organisation','user')),
  platform_id      uuid not null,
  linked_at        timestamptz not null default now(),
  linked_by        uuid references public."user"(id),
  primary key (workspace_id, app_id, app_entity, app_record_id)
);
create index app_record_link_platform_idx on public.app_record_link (platform_entity, platform_id);
create index app_record_link_app_idx      on public.app_record_link (workspace_id, app_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.app_entity_mapping enable row level security;
alter table public.app_record_link    enable row level security;

-- Read: any authenticated user in the workspace.
-- Write: service_role only (the API is the only writer; manifests are
--        admin-approved through the API, not the client).
create policy app_entity_mapping_read on public.app_entity_mapping
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

create policy app_record_link_read on public.app_record_link
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- Backfill: seed mappings for our own first-party apps so the contract is
-- visible from day one. These are the entities each Meet route currently
-- writes that cross the platform wall.
-- ---------------------------------------------------------------------------
do $$
declare
  v_meet_app   uuid;
  v_workspace  uuid;
begin
  select id into v_meet_app from public.app where slug = 'fibre-meet';
  if v_meet_app is null then
    return;
  end if;

  for v_workspace in select id from public.workspace loop
    -- A Meet booking references a person via invitee_person_id; the booking
    -- itself isn't a person, so mapping_kind = 'reference'.
    insert into public.app_entity_mapping (
      workspace_id, app_id, app_entity, platform_entity, mapping_kind, match_on
    ) values (
      v_workspace, v_meet_app, 'meet_booking', 'person', 'reference', array['invitee_email']
    ) on conflict do nothing;

    -- A meet_host represents a user.
    insert into public.app_entity_mapping (
      workspace_id, app_id, app_entity, platform_entity, mapping_kind, match_on
    ) values (
      v_workspace, v_meet_app, 'meet_host', 'user', 'identity', array['user_id']
    ) on conflict do nothing;

    -- A meet_team_member maps to a user.
    insert into public.app_entity_mapping (
      workspace_id, app_id, app_entity, platform_entity, mapping_kind, match_on
    ) values (
      v_workspace, v_meet_app, 'meet_team_member', 'user', 'reference', array['user_id']
    ) on conflict do nothing;
  end loop;
end $$;
