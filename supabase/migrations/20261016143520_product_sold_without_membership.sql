-- MEMBERS-ONLY BY DEFAULT: a renewing product is subscribed to WITHOUT a
-- membership only when the community says so (Sjoerd, 2026-10-16, on
-- production soul.com: "Per product a tickbox: only with membership").
--
-- v1.246.0 let a purchasable recurring product be subscribed to on its own.
-- But on production `purchasable = true` on a recurring product had been set
-- under the OLDER meaning — "sold as an extra with any membership" — so
-- shipping that as-is would have offered soul.com's members-only products
-- (the community email address, the Fellowship pathway) to anybody. This
-- column makes standalone subscription an explicit opt-in.
--
-- DEFAULT false: every existing product, production included, stays
-- members-only with no data edit. The admin dialog shows it inverted as
-- "Only with a membership" (ticked by default). Which memberships a product
-- belongs to stays where it is: the tier's product links.
--
-- Additive: one column with a default, nothing existing changes.
alter table public.membership_product
  add column if not exists sold_without_membership boolean not null default false;

comment on column public.membership_product.sold_without_membership is
  'A RECURRING product may be subscribed to without a membership (/public/subscribe) only when true. Default false = members only. Shown in the admin as "Only with a membership" (inverted).';
