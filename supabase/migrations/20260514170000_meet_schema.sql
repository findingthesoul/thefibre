-- ============================================================================
-- v0.5.2 — Fibre Meet schema (lean skeleton ported from Soul Suite).
--
-- All Meet content lives on the Fibre DB, scoped to workspace_id and gated
-- by app_membership('fibre-meet') via RLS. Identity (persons, users,
-- workspaces) stays on the platform tables — Meet references them by id.
--
-- Scope of this migration: the core booking loop.
--   meet_host         — per-user Meet config (timezone, working hours, OAuth)
--   meet_calendar     — host's connected Google calendars
--   meet_intake_form  — reusable invitee-question schemas
--   meet_meeting_type — bookable offerings (slug-routed)
--   meet_booking      — concrete bookings against a meeting type
--
-- Deferred to a later migration (Suite has them; we don't need them yet):
--   projects/teams, round-robin fairness state, polls + poll responses,
--   one-off slot inventory, paid-meeting + invoice flows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- meet_host — per-user Meet configuration. Joins to public.user.
-- One row per user who hosts (will be created lazily on first Meet sign-in).
-- ---------------------------------------------------------------------------
create table public.meet_host (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references public."user"(id) on delete cascade,
  workspace_id            uuid not null references public.workspace(id) on delete cascade,
  -- Public slug for the host's booking page (meet.thefibre.app/<slug>/<meeting-type>).
  -- Workspace-scoped uniqueness — different workspaces can both have a 'sjoerd'.
  slug                    text not null,
  timezone                text not null default 'Europe/Amsterdam',
  -- weekly availability — { mon: [{start:'09:00',end:'17:00'}], tue: [...], ... }
  working_hours           jsonb,
  -- Profile fields displayed on the booking page.
  bio                     text,
  photo_url               text,
  location                text,
  personal_room_url       text,
  -- OAuth / external integrations. Tokens are sensitive — never returned to web
  -- via /auth/me; only the API reads them when creating a Google event etc.
  google_refresh_token    text,
  zoom_refresh_token      text,
  zoom_account_email      citext,
  zoom_connected_at       timestamptz,
  stripe_account_id       text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index meet_host_workspace_idx on public.meet_host (workspace_id);

-- ---------------------------------------------------------------------------
-- meet_calendar — Google calendars the host has connected. Each row picks a
-- role: PRIMARY (write target by default), CONFLICT_CHECK (read-only conflict
-- source), WRITE_TARGET (alternative write destination).
-- ---------------------------------------------------------------------------
create table public.meet_calendar (
  id                  uuid primary key default gen_random_uuid(),
  host_id             uuid not null references public.meet_host(id) on delete cascade,
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  google_calendar_id  text not null,
  summary             text,
  role                text not null
                        check (role in ('primary','conflict_check','write_target')),
  created_at          timestamptz not null default now(),
  unique (host_id, google_calendar_id)
);
create index meet_calendar_host_idx on public.meet_calendar (host_id);

-- ---------------------------------------------------------------------------
-- meet_intake_form — reusable question schema attached to a meeting type.
-- Personal scope (owned by one host); workspace scope deferred until projects.
-- ---------------------------------------------------------------------------
create table public.meet_intake_form (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  host_id       uuid not null references public.meet_host(id) on delete cascade,
  name          text not null,
  -- [{ key, label, type, required, options?, conditional_on? }]
  fields        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index meet_intake_form_workspace_idx on public.meet_intake_form (workspace_id);
create index meet_intake_form_host_idx on public.meet_intake_form (host_id);

-- ---------------------------------------------------------------------------
-- meet_meeting_type — a bookable offering.
-- ---------------------------------------------------------------------------
create table public.meet_meeting_type (
  id                        uuid primary key default gen_random_uuid(),
  workspace_id              uuid not null references public.workspace(id) on delete cascade,
  host_id                   uuid not null references public.meet_host(id) on delete cascade,
  slug                      text not null,
  name                      text not null,
  description               text,
  duration_minutes          integer not null check (duration_minutes > 0),
  buffer_before_minutes     integer not null default 0,
  buffer_after_minutes      integer not null default 0,
  min_notice_minutes        integer not null default 60,
  max_advance_days          integer not null default 60,
  max_invitees              integer not null default 1 check (max_invitees > 0),
  conferencing_provider     text not null default 'google_meet'
                              check (conferencing_provider in
                                     ('google_meet','zoom','teams','in_person','personal_room','none')),
  default_location          text,
  -- Conflict calendar override — array of meet_calendar.id. Empty = use host defaults.
  conflict_calendar_ids     uuid[] not null default '{}'::uuid[],
  -- Override host's weekly schedule for this meeting type only.
  working_hours_override    jsonb,
  intake_form_id            uuid references public.meet_intake_form(id) on delete set null,
  include_answers_in_event  boolean not null default false,
  is_active                 boolean not null default true,
  -- Pricing — held but enforced in a later migration (Stripe wiring).
  price_cents               integer,
  price_currency            char(3),
  created_at                timestamptz not null default now(),
  unique (host_id, slug)
);
create index meet_meeting_type_workspace_idx on public.meet_meeting_type (workspace_id);
create index meet_meeting_type_host_idx on public.meet_meeting_type (host_id);

-- ---------------------------------------------------------------------------
-- meet_booking — a concrete booking. invitee can be a known Fibre person
-- (FK to public.person) or a brand-new contact (we upsert person on booking).
-- ---------------------------------------------------------------------------
create table public.meet_booking (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspace(id) on delete cascade,
  meeting_type_id          uuid not null references public.meet_meeting_type(id),
  host_id                  uuid not null references public.meet_host(id),
  invitee_person_id        uuid references public.person(id),
  invitee_email            citext not null,
  invitee_name             text not null,
  invitee_answers          jsonb,
  starts_at                timestamptz not null,
  ends_at                  timestamptz not null,
  status                   text not null default 'confirmed'
                             check (status in ('confirmed','cancelled','rescheduled')),
  conferencing_provider    text
                             check (conferencing_provider in
                                    ('google_meet','zoom','teams','in_person','personal_room','none')),
  meet_url                 text,
  provider_meeting_id      text,
  alternative_location     text,
  google_event_id          text,
  -- Idempotency for Google event creation.
  request_id               text not null unique,
  -- Payment fields (held; populated only when the price/invoice migration lands).
  payment_status           text not null default 'not_required'
                             check (payment_status in
                                    ('not_required','pending','paid','refunded','failed','invoice_pending','invoice_sent')),
  payment_method           text not null default 'stripe'
                             check (payment_method in ('stripe','invoice')),
  invoice_details          jsonb,
  stripe_session_id        text,
  stripe_payment_intent    text,
  created_at               timestamptz not null default now()
);
create index meet_booking_host_starts_idx on public.meet_booking (host_id, starts_at);
create index meet_booking_meeting_type_idx on public.meet_booking (meeting_type_id);
create index meet_booking_meeting_type_starts_idx on public.meet_booking (meeting_type_id, starts_at);
create index meet_booking_workspace_idx on public.meet_booking (workspace_id);
create index meet_booking_person_idx on public.meet_booking (invitee_person_id) where invitee_person_id is not null;

-- ---------------------------------------------------------------------------
-- RLS — every Meet table is gated by (workspace match) AND (has fibre-meet
-- app_membership). The latter uses the existing has_app_membership() helper.
-- ---------------------------------------------------------------------------

alter table public.meet_host        enable row level security;
alter table public.meet_calendar    enable row level security;
alter table public.meet_intake_form enable row level security;
alter table public.meet_meeting_type enable row level security;
alter table public.meet_booking     enable row level security;

create policy meet_host_scope on public.meet_host
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

create policy meet_calendar_scope on public.meet_calendar
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

create policy meet_intake_form_scope on public.meet_intake_form
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

create policy meet_meeting_type_scope on public.meet_meeting_type
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

create policy meet_booking_scope on public.meet_booking
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

-- ---------------------------------------------------------------------------
-- updated_at trigger for meet_host (only one with that column for now).
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meet_host_updated_at
  before update on public.meet_host
  for each row execute function public.set_updated_at();
