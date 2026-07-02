-- Does a Fibre account (auth user) exist for this email? The public enrol
-- flow words its CTA with it: existing account → "sign in to your personal
-- page", none → "create your account". The account is platform-wide — one
-- login covers Thread enrolments, Meet bookings and everything after.
-- Service-role only; never callable from anon/authenticated.
create or replace function public.auth_user_exists(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email));
$$;

revoke all on function public.auth_user_exists(text) from public, anon, authenticated;
grant execute on function public.auth_user_exists(text) to service_role;
