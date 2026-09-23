-- To do is something you can switch off.
--
-- Sjoerd, 2026-09-23, asked for an ON/OFF for the To do panel and, asked
-- where, said "profile settings". So it is a per-PERSON preference, not a
-- workspace setting and not a plan gate: one person turning their own list
-- off says nothing about anyone else's.
--
-- It lives on identity_profile, beside `locale`, for the reason that table
-- exists: a preference about YOU follows you between workspaces, and it
-- should follow you between devices too. The panel's open/closed state stays
-- a per-browser cookie — that one is about this screen right now. The two do
-- not fight: off hides the button entirely, and the open cookie is simply not
-- read while it is off.
--
-- Default true: everybody who has it today keeps it, and nothing about a new
-- account needs deciding before it can be used.

alter table public.identity_profile
  add column if not exists todo_enabled boolean not null default true;

comment on column public.identity_profile.todo_enabled is
  'Whether this person wants the To do panel at all (Settings → Profile). '
  'Per person, follows them between workspaces and devices.';
