-- A tier that is not on the join page, but can still be joined by a link.
--
-- Sjoerd, 2026-10-14: "can you set that a tier can also be NOT visible on a
-- page?" The case is an invitation — a founding rate, a board tier, a price
-- agreed with one organisation — that should not sit in the public list where
-- everybody prices themselves against it, but must still be joinable by the
-- people who were offered it.
--
-- HIDDEN IS NOT ARCHIVED, and the distinction is the whole point:
--
--   archived_at  the tier is finished. Nobody new joins it, by any route.
--   hidden       the tier is live and sells normally; it is simply not
--                advertised.
--
-- So existing members keep everything and renewals are untouched — a renewal
-- never reads the catalogue, it follows the subscription.
--
-- Additive, default false, so every tier that exists keeps behaving exactly
-- as it does now. The published contract (`/api/v1/apps/*`, hard rule 8) is
-- not touched either: the public catalogue DROPS a hidden tier from its list
-- rather than gaining a field that changes what an existing one means, which
-- is the additive-only way to express this.

alter table public.membership_tier
  add column if not exists hidden boolean not null default false;

comment on column public.membership_tier.hidden is
  'Not listed on the public join page. Still joinable by direct link (?tier=<id>) and unaffected for existing members and renewals — unlike archived_at, which ends the tier for everybody. The public catalogue omits these rows; the single-tier endpoint serves them by id.';

-- Partial, because the only question ever asked of this column is "which
-- tiers do I put on the page", and that reads the common case. A full index
-- on a boolean that is false for nearly every row earns nothing.
create index if not exists membership_tier_listed_idx
  on public.membership_tier (workspace_id, sort_order)
  where hidden = false and archived_at is null;
