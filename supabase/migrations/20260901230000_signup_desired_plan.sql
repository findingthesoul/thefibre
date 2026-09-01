-- ============================================================================
-- The request-access form finally asks WHICH product.
--
-- Sjoerd, testing the funnel (2026-09-01): "I have registered — but never I
-- had to make the choice for a product." /pricing said €19 and €49 and then
-- the form ignored the answer. The choice travels with the request now:
-- shown at /admin/access-requests, echoed in the welcome email. The workspace
-- itself still starts on Free — a paid plan begins at Settings → Plan
-- checkout, after sign-in, when there is somebody to charge.
-- ============================================================================

alter table public.signup_request
  add column if not exists desired_plan text references public.billing_plan(id);

comment on column public.signup_request.desired_plan is
  'The package the applicant picked on /pricing or the form. Advisory: approval still provisions Free; payment happens at Settings → Plan after sign-in. Null = "not sure yet".';
