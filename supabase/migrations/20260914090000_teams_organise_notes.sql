-- ============================================================================
-- Teams as a way to ORGANISE what people record — not a wall around it.
--
-- Sjoerd, 2026-09-14: *"teams do play a role, but in an organizing way. So
-- [somebody] can be part of more than one team. As I'm logged in, and I'm the
-- one who's making the contribution to what happened, then in the right top
-- somehow, I'm automatically selected. But when I do what happened, I can open
-- it, and then I can see the teams I am part of... I can have a default team...
-- And then in my to do, I can make a selection of the things that have shifted
-- last week or last two weeks... And I see all my updates of that team. And it
-- means that everybody part of the team is then listed. And this way, we can do
-- an update meeting."*
--
-- He also asked for it to be a generic model rather than a Connections one.
-- The platform already has everything generic about teams: `team` is
-- workspace-scoped, `team_member` is many-to-many with a lead/member role and
-- an active/invited status, and since 2026-09-11 teams also grant app seats.
-- What is missing is small and is all this migration adds:
--
--   1. which of your teams is your DEFAULT, and
--   2. which team a recorded thing was filed under.
--
-- ── A filter, not a wall — the decision that matters ───────────────────────
--
-- `team_id` on a note says what it is ABOUT for the people organising their
-- work. It does not narrow who can read it: RLS on flow_run_note is untouched
-- and every note stays visible across the workspace exactly as today. His own
-- word was "organizing". Making a team a visibility boundary would change the
-- policy on every note, would hide one colleague's work from another who is
-- in a different team, and is a much larger decision than this ask — so it is
-- deliberately not made here.
--
-- ── Why nullable, everywhere ───────────────────────────────────────────────
--
-- Most workspaces will never use teams this way. A note filed under no team
-- must stay a perfectly ordinary note, and every existing note is exactly that.
--
-- ── One default per person per WORKSPACE ───────────────────────────────────
--
-- A person can belong to teams in several workspaces, and needs a default in
-- each. `team_member` has no workspace column, so no simple unique index can
-- say "one default per person per workspace". A trigger could, but the API is
-- the only writer of this flag and clears the others in the same workspace in
-- one statement before setting the new one. If two defaults ever coexist, the
-- reader picks the earliest-created, so the answer is stable, never random.
-- ============================================================================

alter table public.team_member
  add column if not exists is_default boolean not null default false;

comment on column public.team_member.is_default is
  'This person''s preselected team when they record something in this team''s workspace. At most one per person per workspace, kept by the API (see migration header for why not a constraint).';

alter table public.flow_run_note
  add column if not exists team_id uuid references public.team(id) on delete set null;

comment on column public.flow_run_note.team_id is
  'The team this note was filed under, for organising and team updates. A FILTER, not a visibility boundary: RLS is unchanged and the note is as visible as any other. Null = filed under no team. Set null if the team is deleted, so no note disappears with its team.';

-- The team-update read: a team's notes over a period, newest first.
create index if not exists flow_run_note_team_idx
  on public.flow_run_note (team_id, happened_at desc)
  where team_id is not null and deleted_at is null;
