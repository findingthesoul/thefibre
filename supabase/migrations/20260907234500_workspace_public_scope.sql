-- Workspace public URLs (docs/brief-workspace-urls.md, Sjoerd 2026-09-07:
-- "It is the organisation. Sometimes even workspace/organiser/thread").
--
-- A thread can now publish under the WORKSPACE's slug. public_scope is the
-- thread's choice: null = legacy behaviour (team when team_id set, else
-- personal); 'workspace' puts the canonical public URL at
-- /{workspace-slug}/{thread}. The old organiser/team addresses stay
-- resolvable (forgiving dual addressing — canonical is in the payload).

alter table public.thread_thread
  add column public_scope text
    check (public_scope in ('personal', 'team', 'workspace'));
