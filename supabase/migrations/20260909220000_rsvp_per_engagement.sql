-- RSVP moves to the agenda item.
--
-- v0.68.30 put the switch at two levels: a workspace default and a per-thread
-- override. Sjoerd, after seeing the organiser's Responses panel for the first
-- time (2026-09-09): "maybe it is better to set it per event... so per event
-- toggle RSVP and then you have the second tab."
--
-- He is right, and the reason is visible in a year-long thread: a residential
-- weekend needs a headcount and the reading group before it does not. One
-- switch for the whole thread makes you choose between asking about everything
-- and asking about nothing.
--
-- A THIRD level rather than a replacement. NULL means inherit, so resolution
-- is item -> thread -> workspace default -> true, and nothing that exists
-- changes behaviour. The rule the thread column already states applies here
-- unchanged: NULL is not a boolean default, so an item follows its thread as
-- the thread changes rather than freezing at creation time.

alter table public.thread_engagement
  add column if not exists rsvp_enabled boolean;

comment on column public.thread_engagement.rsvp_enabled is
  'Per-item RSVP override. NULL means inherit thread_thread.rsvp_enabled, which itself inherits thread_settings.rsvp_default_enabled. Only timed items can be answered, so this has no effect where starts_at is null.';
