-- A thread's to-do list is its own plan feature, so the tier is a checkbox.
--
-- Sjoerd, 2026-09-23: *"Can I check that decision with a checkbox? Maybe it is
-- between starter and pro"* — asked about the open question from v0.112.0,
-- which was whether a thread's checklist should sit behind a plan at all.
--
-- It now has its own key rather than borrowing `todo`, because the two are
-- different products sold to different people:
--
--   todo         the PERSONAL cross-app list in every topbar. Organisation
--                only (20260923130000) — it is the thing that pulls Flow,
--                Connect and Thread into one queue, which is what an
--                organisation is buying.
--   thread_todo  the SHARED checklist on one thread, seen by its organisers
--                and hosts. It is part of running an event, and belongs with
--                the rest of The Thread.
--
-- Sharing one key would have meant that deciding the price of one decided the
-- price of the other forever.
--
-- THE VALUES HERE ARE A STARTING POINT, NOT THE DECISION. Sjoerd's steer was
-- "maybe between starter and pro", so that is where the line starts: off for
-- free and starter, on from pro up. The point of this migration is that the
-- line is now MOVABLE at /admin/plans without a deploy — the key is what
-- needs code, the value never did.
--
-- `beta` gets it for the same reason it gets everything: a beta workspace is
-- being shown the whole product, and applyBetaExpiry takes it back.

update public.billing_plan
   set features = coalesce(features, '{}'::jsonb) || '{"thread_todo": true}'::jsonb
 where id in ('pro', 'org', 'beta');

update public.billing_plan
   set features = coalesce(features, '{}'::jsonb) || '{"thread_todo": false}'::jsonb
 where id in ('free', 'starter');
