-- Google Workspace integration (Sjoerd, 2026-09-06: "in Lapsed, can we also
-- pause the USER in Google?"). Second row in the integrations list, after
-- Circle: a per-workspace admin credential + the 'google_user' grant kind.
-- The worker SUSPENDS a member's Google account on lapse and unsuspends on
-- (re)join — it never creates or deletes accounts.
--
-- Credential rule (same as circle_api_token above these columns):
-- membership_settings is service-role only — RLS enabled with NO
-- authenticated policy; all access through the API. The service-account
-- JSON is a private key: the API only ever echoes whether it is SET.
alter table public.membership_settings
  add column if not exists google_sa_json text,
  add column if not exists google_admin_email text;

comment on column public.membership_settings.google_sa_json is
  'Google service-account key JSON (domain-wide delegation). Secret — never echoed to clients.';
comment on column public.membership_settings.google_admin_email is
  'The Workspace admin the service account impersonates (delegation subject).';
