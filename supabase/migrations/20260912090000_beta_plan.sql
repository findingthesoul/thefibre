-- ============================================================================
-- Beta — a plan above Enterprise (Sjoerd, 2026-09-12).
--
-- "Give one more plan above enterprise. Beta... it is companies that get the
-- newest apps to test for a while."
--
-- So the tier is not about volume or support. It is about EARLINESS: a beta
-- workspace can switch on an app the rest of the platform cannot see yet, and
-- it can do so for a bounded period.
--
-- Three small things rather than one big one, each answering a different
-- question, in the spirit of 20260824210000 ("two questions, two columns"):
--
--   app.beta_at                     is this app ready enough to be TESTED?
--   billing_plan.is_public          does this plan appear on the price list?
--   workspace_subscription.beta_until  until when is this company a tester?
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. app.beta_at — the state between "not built" and "live".
--
-- 20260824210000 gave the catalogue two questions: `status` is review ("has a
-- human allowed this to act") and `released_at` is existence ("is there a
-- product behind it"). Beta needs a third answer that neither can give: an
-- app that renders real pages, is worth a tester's time, and is NOT ready for
-- everyone.
--
-- Deliberately not a third value of `released_at`. A timestamp that sometimes
-- means "live to all" and sometimes "live to some" is the overloading that
-- migration refused. Releasing generally later just sets released_at; beta_at
-- stays as the record of when testing started.
--
--   beta_at null,  released_at null  → not built. Nobody can activate it.
--   beta_at set,   released_at null  → testable. Beta workspaces only.
--   released_at set                  → live for everyone, whatever beta_at says.
-- ---------------------------------------------------------------------------
alter table public.app
  add column if not exists beta_at timestamptz;

comment on column public.app.beta_at is
  'When this app opened to beta testers. Set with released_at still null, the app can be activated ONLY by a workspace whose plan carries the beta_apps feature. released_at always wins: once it is set the app is live for everyone.';

create index if not exists app_beta_idx on public.app (beta_at)
  where beta_at is not null and released_at is null;

-- ---------------------------------------------------------------------------
-- 2. billing_plan.is_public — Beta is invited, not bought.
--
-- /api/v1/public/plans is what the pricing page renders, and it has always
-- returned every row. A tier you get asked into should not sit on the price
-- list next to the ones you can buy. Every existing plan stays public; only
-- the new row opts out.
-- ---------------------------------------------------------------------------
alter table public.billing_plan
  add column if not exists is_public boolean not null default true;

comment on column public.billing_plan.is_public is
  'Whether this plan appears in the signed-out catalogue at /api/v1/public/plans. False = invite-only; it still gates, still shows in /admin/plans, and still appears on the plan page of a workspace that is on it.';

-- ---------------------------------------------------------------------------
-- 3. workspace_subscription.beta_until — "for a while", written down.
--
-- NOTE for whoever reads this next: `comped_until` on this same table is
-- stored and never read — planFor() does not look at it, so a comp with an
-- end date does not actually end. beta_until is NOT like that; plan.ts
-- enforces it. Left alone rather than quietly fixed, because making comps
-- start expiring is a billing change and belongs to whoever decides it.
--
-- What expiry does: the beta_apps feature stops. Nothing else about the plan
-- changes and no app is switched off — a tester keeps what they already
-- turned on, they just stop being first in the queue. Yanking a live app out
-- of a company's hands because a date passed would be a worse failure than
-- the one it prevents.
-- ---------------------------------------------------------------------------
alter table public.workspace_subscription
  add column if not exists beta_until timestamptz;

comment on column public.workspace_subscription.beta_until is
  'When this workspace stops being a beta tester. Null = no end date. Enforced in lib/plan.ts: past this moment the beta_apps feature is dropped from the resolved plan; already-activated apps are left running.';

-- ---------------------------------------------------------------------------
-- 4. The plan row.
--
-- Everything Enterprise has, plus beta_apps. Priced like Enterprise — 0,
-- meaning "a conversation" rather than "free" — and invisible on the price
-- list. The features are copied FROM the org row rather than retyped, so a
-- feature added to Enterprise before this migration runs cannot be silently
-- missing from Beta.
-- ---------------------------------------------------------------------------
insert into public.billing_plan (
  id, name, price_cents_user_month, price_cents_month, price_cents_year,
  meet_paid_pct, meet_paid_cap_cents, included_seats, extra_seat_cents_month,
  included_emails_month, included_storage_gb, retention_months,
  is_public, features
)
select
  'beta',
  'Beta',
  org.price_cents_user_month,
  0,                      -- POA, like Enterprise
  null,
  org.meet_paid_pct,
  org.meet_paid_cap_cents,
  org.included_seats,
  org.extra_seat_cents_month,
  org.included_emails_month,
  org.included_storage_gb,
  org.retention_months,
  false,                  -- invite-only
  org.features || '{"beta_apps": true}'::jsonb
from public.billing_plan org
where org.id = 'org'
on conflict (id) do nothing;
