-- ============================================================================
-- v0.5.3 — public.app is reference data. Every authenticated user needs to
-- read it (the API route handlers select by slug to resolve app_id, the web
-- joins it from app_membership and workspace_app, etc.).
--
-- Supabase auto-enables RLS on every public-schema table; without a policy
-- the userClient returns zero rows, which surfaces in our handlers as
-- "app not found" → 404. Fix is a single permissive read policy.
-- ============================================================================

drop policy if exists app_public_read on public.app;
create policy app_public_read on public.app
  for select
  to authenticated
  using (true);
