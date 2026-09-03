-- ============================================================================
-- Event templates become a plan dimension (Sjoerd, 2026-09-03): Free = the
-- basic template only, Starter picks from 5, Pro/Enterprise get the whole
-- library plus the designer (the existing thread_custom_templates key).
--
-- Numeric like thread_live_limit: a count, jsonb null = unlimited. The
-- template LIBRARY itself is still to be designed — this ships the pricing
-- dimension so the packages tell the truth the day the library lands;
-- enforcement arrives with the library (build-plan queue).
-- ============================================================================

update public.billing_plan set features = features || jsonb_build_object('thread_template_limit', 1)    where id = 'free';
update public.billing_plan set features = features || jsonb_build_object('thread_template_limit', 5)    where id = 'starter';
update public.billing_plan set features = features || jsonb_build_object('thread_template_limit', null) where id = 'pro';
update public.billing_plan set features = features || jsonb_build_object('thread_template_limit', null) where id = 'org';
