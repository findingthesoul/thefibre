-- ============================================================================
-- Payments become a true platform SPoT (Sjoerd 2026-07-04: "a setting in one
-- app used in others — make it work as a SPoT").
--
-- Personal level  → user_profile.{stripe_account_id, invoice_details,
--                   default_payment_methods}
-- Workspace level → workspace.{stripe_account_id, invoice_details}
--
-- The app-local columns (meet_host.stripe_account_id,
-- thread_organiser.stripe_account_id, thread_settings.stripe_account_id)
-- stay as READ FALLBACKS for old rows but are no longer written by settings
-- pages. Backfilled below (Meet's value wins — it's the oldest connection).
-- ============================================================================

alter table public.user_profile
  add column if not exists stripe_account_id text,
  add column if not exists invoice_details jsonb,
  add column if not exists default_payment_methods text[];

alter table public.workspace
  add column if not exists stripe_account_id text,
  add column if not exists invoice_details jsonb;

-- Provision user_profile rows for users that have payment config but no
-- profile yet, then backfill.
insert into public.user_profile (user_id, display_name)
select u.id, u.full_name
  from public."user" u
 where u.deleted_at is null
   and not exists (select 1 from public.user_profile p where p.user_id = u.id)
   and (
     exists (select 1 from public.meet_host mh where mh.user_id = u.id and mh.stripe_account_id is not null)
     or exists (select 1 from public.thread_organiser t where t.user_id = u.id and (t.stripe_account_id is not null or t.invoice_details is not null))
   )
on conflict (user_id) do nothing;

update public.user_profile p
   set stripe_account_id = coalesce(
         (select mh.stripe_account_id from public.meet_host mh where mh.user_id = p.user_id),
         (select t.stripe_account_id from public.thread_organiser t where t.user_id = p.user_id)
       )
 where p.stripe_account_id is null;

update public.user_profile p
   set invoice_details =
         (select t.invoice_details from public.thread_organiser t where t.user_id = p.user_id)
 where p.invoice_details is null;

update public.workspace w
   set stripe_account_id = ts.stripe_account_id,
       invoice_details   = coalesce(w.invoice_details, ts.invoice_details)
  from public.thread_settings ts
 where ts.workspace_id = w.id
   and w.stripe_account_id is null;

-- ============================================================================
-- Payment-type inheritance: account → thread → ticket (null = inherit).
-- Resolution at enrol time: ticket ?? thread ?? organiser's account default
-- ?? {stripe}.
-- ============================================================================

alter table public.thread_thread
  alter column payment_methods drop not null,
  alter column payment_methods drop default;

-- Existing rows that carry the old default now mean "inherit".
update public.thread_thread
   set payment_methods = null
 where payment_methods = '{stripe}';

alter table public.thread_ticket
  add column if not exists payment_methods text[];
