-- thread_key_moments_and_signup_close
--
-- Sjoerd, 2026-10-16: a thread has three dates — its period (program
-- starts_on/ends_on, internal), its EVENT dates (public, from the sessions
-- marked "key moment"), and when SIGN-UPS CLOSE. Additive; nothing reads
-- these until the code that writes them ships, and a thread with no key
-- moment behaves exactly as before.

-- A session that defines the thread's public event dates. Any timed item may
-- be one (Sjoerd: "every timed item").
alter table public.thread_engagement
  add column if not exists is_key_moment boolean not null default false;

-- "Open until session N": sign-ups close when THIS session starts. Null = the
-- first key moment (or, with none, the fallback in @thefibre/shared
-- thread-dates). Stored as the session's id, not a position, so reordering
-- the timeline cannot move the deadline; deleting the session clears it.
alter table public.thread_thread
  add column if not exists signups_close_engagement_id uuid
    references public.thread_engagement(id) on delete set null;
