-- Review finding #13: refunds must run on the account the CHARGE landed on,
-- not on today's settings (which may have changed). Store it at record time.
alter table public.purchase
  add column if not exists stripe_account_id text;
