-- The email and storage allowances become real.
--
-- Sjoerd, 2026-09-23: *"DO: set prices and the allowances become real
-- (auto-billed, no interruption)."*
--
-- The numbers are not new — they are his own, decided in
-- docs/pricing-proposal.md and never applied: **€1 per 1,000 emails** and
-- **€0.50 per GB per month**. The €8 extra seat from the same line has been
-- live for weeks; these two were the half that stayed null.
--
-- A NULL unit price means "the allowance is soft and nothing bills"
-- (lib/usage-meters.ts). So until now Starter's 2,000 emails and Pro's 10,000
-- were advisory: a workspace sailed past them and got a warning at 80% and
-- nothing else. After this, last month's excess becomes an invoice item on the
-- next subscription invoice.
--
-- **Nothing is ever refused.** That is the rule from the proposal and it is
-- what he asked for: *"a bundle nobody normal exceeds, and an overage that
-- never surprises... never refuse to send. A ticket that does not arrive
-- because a workspace crossed a threshold is not a billing event, it is a
-- failure."*
--
-- Only starter and pro:
--   free   has no subscription to bill, so a price there is inert, and its
--          control is the 13-month archive, not a charge. Setting one would
--          say we charge Free workspaces, and we do not.
--   org    and beta have unlimited allowances — an overage cannot arise.
--
-- Checked before writing: no workspace on production is on starter or pro, so
-- this bills nobody today. It sets the rule for whoever arrives next.

update public.billing_plan
   set email_overage_cents_per_1000 = 100,   -- €1.00 per 1,000 emails
       storage_overage_cents_per_gb = 50     -- €0.50 per GB per month
 where id in ('starter', 'pro');
