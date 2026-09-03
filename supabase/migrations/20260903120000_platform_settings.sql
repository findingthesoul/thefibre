-- ============================================================================
-- Platform settings — operator-level switches that are data, not deploys.
--
-- First resident: auto_approve_signups (Sjoerd, 2026-09-03, after walking the
-- funnel as a customer: "By default approve — make a toggle for approve or
-- not for super admin"). Service-role only; read through
-- lib/platform-settings.ts, toggled at /admin/access-requests.
-- ============================================================================

create table public.platform_setting (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_setting enable row level security;
-- No policies on purpose: service-role only, like app_key.

insert into public.platform_setting (key, value)
values ('auto_approve_signups', 'true'::jsonb)
on conflict (key) do nothing;
