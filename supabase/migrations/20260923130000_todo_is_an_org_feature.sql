-- To do is an Organisation-plan feature.
--
-- Sjoerd, 2026-09-23: *"TO do's is only from org level plan."*
--
-- The KEY has to be declared in code (lib/plan.ts's PlanFeature union — a new
-- feature key is a deploy, on purpose); this sets the VALUE on the plan rows,
-- which is data and belongs here. Org gets it, nobody else does.
--
-- `beta` is deliberately included: a beta workspace is being shown the whole
-- product, and applyBetaExpiry takes it away again when the beta ends.

update public.billing_plan
   set features = coalesce(features, '{}'::jsonb) || '{"todo": true}'::jsonb
 where id in ('org', 'beta');

update public.billing_plan
   set features = coalesce(features, '{}'::jsonb) || '{"todo": false}'::jsonb
 where id in ('free', 'starter', 'pro');
