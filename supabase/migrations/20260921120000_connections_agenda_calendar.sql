-- ============================================================================
-- Which of my calendars feed Connections' agenda.
--
-- Sjoerd, 2026-09-21: *"In the interface: select agenda's available to me.
-- And select one or more. Maybe popup. And then put agenda's on and off."*
--
-- Today's agenda reads every calendar the signed-in person OWNS. That is one
-- calendar too many the moment somebody keeps a private one, and one too few
-- the moment a team calendar they only read is where the real meetings are.
-- This table is that choice, made once and remembered.
--
-- ── Per user, not per workspace ────────────────────────────────────────────
--
-- "Who is in my day" is not a workspace-level fact — the agenda route says so
-- and refuses to read another user's calendar even for an admin. So the row
-- is keyed by user, and an admin has no business reading it. The workspace is
-- on the row anyway because the same person can carry Connections in two
-- workspaces and may want different calendars in each.
--
-- ── Sparse, and the default is the OLD behaviour ───────────────────────────
--
-- An absent row means "use the default", and the default is: on when the
-- person owns the calendar, off when they merely subscribe to it. So nobody's
-- agenda changes the day this ships, a newly made calendar appears by itself,
-- and a holiday feed somebody once subscribed to does not start filling the
-- page. A row is only written when somebody disagrees, and then it wins.
--
-- No CHECK and no FK on calendar_id: it is Google's opaque id (usually an
-- address, sometimes a long @group.calendar.google.com string), and a
-- calendar that is deleted at Google leaves a row here that is simply never
-- matched again. Inert, the same reasoning as connections_band_label.kind.
-- ============================================================================

create table if not exists public.connections_agenda_calendar (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  user_id      uuid not null references public."user"(id) on delete cascade,
  calendar_id  text not null,
  enabled      boolean not null,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, user_id, calendar_id)
);

comment on table public.connections_agenda_calendar is
  'Per USER: which Google calendars feed Connections Today/agenda. Sparse — an absent row means the default (on if owned, off if only subscribed). Never readable by a colleague or an admin: "who is in my day" is not a workspace fact.';

alter table public.connections_agenda_calendar enable row level security;

-- Yours and nobody else's, read and write. Not even a workspace admin — this
-- says which parts of somebody's private calendar life the app may look at.
drop policy if exists connections_agenda_calendar_own on public.connections_agenda_calendar;
create policy connections_agenda_calendar_own on public.connections_agenda_calendar
  for all to authenticated
  using (
    user_id = public.current_user_id()
    and workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-sales')
  )
  with check (
    user_id = public.current_user_id()
    and workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-sales')
  );
