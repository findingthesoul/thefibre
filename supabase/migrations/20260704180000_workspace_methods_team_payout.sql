-- Sjoerd 2026-07-04, payments follow-through:
-- 1. Workspace-level default payment options — team/workspace-destination
--    threads inherit THESE (personal threads inherit the organiser's).
-- 2. Teams choose where their sales land: the workspace account (default)
--    or the team lead's personal account.
alter table public.workspace
  add column if not exists default_payment_methods text[];

alter table public.team
  add column if not exists payout_destination text not null default 'workspace'
    check (payout_destination in ('workspace','lead'));
