-- ============================================================================
-- Your profile belongs to YOU, not to a seat.
--
-- Sjoerd, 2026-09-01: "if I'm in various workspaces, do I need to make a
-- profile over and over?" He did, and the data said so out loud: his
-- Solidarity Lab profile had a bio and his invoice details, his Festival of
-- Trust profile had a photo and neither. Tahirih had one in one workspace and
-- none in the other.
--
-- The cause is one line: user_profile.user_id references public."user"(id),
-- and a user row is per workspace. A seat is per workspace on purpose — your
-- role, your apps, your visibility all differ per tenant, and that is the
-- point. Your FACE is not one of those things.
--
-- Keyed by email, because that is already how the platform recognises you
-- across workspaces (auth.myMemberships matches seats by email, v0.19.1).
--
-- TWO TABLES, NOT ONE, AND THAT IS THE OTHER FIX HERE.
-- user_profile is readable by everybody in the workspace — "they're public
-- faces", said the comment, and it was right about faces. But the payments
-- SPoT later added invoice_details and stripe_account_id to the same row, so
-- since v0.13.95 a member's personal legal name, home address and tax number
-- have been readable by every other member of their workspace. RLS cannot
-- withhold a column, so the private half moves to its own table with its own
-- policy: owner only.
-- ============================================================================

create table if not exists public.identity_profile (
  email         citext primary key,
  display_name  text,
  bio           text,
  photo_url     text,
  timezone      text not null default 'Europe/Amsterdam',
  updated_at    timestamptz not null default now()
);

create table if not exists public.identity_billing (
  email                    citext primary key,
  stripe_account_id        text,
  invoice_details          jsonb,
  default_payment_methods  text[],
  updated_at               timestamptz not null default now()
);

alter table public.identity_profile enable row level security;
alter table public.identity_billing enable row level security;

-- Your face: readable by people you share a workspace with, so member lists
-- and organiser pages can show it. Writable only by you.
create policy identity_profile_read on public.identity_profile
  for select to authenticated
  using (exists (
    select 1 from public."user" u
     where u.email = identity_profile.email
       and u.workspace_id = public.current_workspace_id()
       and u.deleted_at is null
  ));

create policy identity_profile_write on public.identity_profile
  for all to authenticated
  using (email = (select u.email from public."user" u where u.id = public.current_user_id()))
  with check (email = (select u.email from public."user" u where u.id = public.current_user_id()));

-- Your billing: yours alone. No read policy for anybody else, deliberately —
-- an address and a tax number are not a public face.
create policy identity_billing_owner on public.identity_billing
  for all to authenticated
  using (email = (select u.email from public."user" u where u.id = public.current_user_id()))
  with check (email = (select u.email from public."user" u where u.id = public.current_user_id()));

-- ---------------------------------------------------------------------------
-- Merge what exists. One person may hold several per-seat profiles that each
-- know a different half of them: take the fullest answer for each field
-- rather than picking a row and losing the rest.
--
-- distinct on + a completeness ordering would pick one row; coalesce over an
-- ordered aggregate keeps the best of each.
-- ---------------------------------------------------------------------------
insert into public.identity_profile (email, display_name, bio, photo_url, timezone)
select
  u.email,
  (array_remove(array_agg(p.display_name order by p.updated_at desc), null))[1],
  (array_remove(array_agg(p.bio          order by p.updated_at desc), null))[1],
  (array_remove(array_agg(p.photo_url    order by p.updated_at desc), null))[1],
  coalesce((array_remove(array_agg(p.timezone order by p.updated_at desc), null))[1], 'Europe/Amsterdam')
  from public.user_profile p
  join public."user" u on u.id = p.user_id
 where u.deleted_at is null
 group by u.email
on conflict (email) do nothing;

-- Billing is set once, not assembled from halves, so the most recent row that
-- has any of it wins outright. (array_agg over a text[] column would build a
-- 2-D array, which array_remove refuses — the aggregate trick above only works
-- for scalars.)
insert into public.identity_billing (email, stripe_account_id, invoice_details, default_payment_methods)
select distinct on (u.email)
       u.email, p.stripe_account_id, p.invoice_details, p.default_payment_methods
  from public.user_profile p
  join public."user" u on u.id = p.user_id
 where u.deleted_at is null
   and (p.stripe_account_id is not null or p.invoice_details is not null or p.default_payment_methods is not null)
 order by u.email, p.updated_at desc
on conflict (email) do nothing;

comment on table public.identity_profile is
  'One face per person, across every workspace they belong to. Keyed by email, the same key that finds their seats. user_profile stays as a read fallback and is no longer written.';
comment on table public.identity_billing is
  'Personal payment details — Stripe account, invoice details. Owner-only by policy: these sat in user_profile, which every workspace member can read (20260901160000).';
