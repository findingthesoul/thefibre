-- custom_domain_plan_key
--
-- The domain package (docs/domain-package.md), Sjoerd 2026-10-06: "go domain
-- package … like one package, for enterprise". Sending from your own ADDRESS
-- stays `custom_sender_domain`, Pro and up — unchanged here. Your own WEB
-- ADDRESS for the public pages (book.soul.com) is this new key, Enterprise
-- (`org`) only.
--
-- Set on every row, explicitly, so the matrix at /admin/plans shows a
-- checkbox in each column rather than a blank. `beta` is the org package with
-- early apps (20260912090000 builds it FROM org), and soul.com — the first
-- workspace this is for — sits on it; so beta carries the key too.
-- `lib/plan.ts` declares the key; apps/web/lib/plans.ts labels it. Both ship
-- in the same release as this file, because a key the reader does not know
-- gates nothing.

update public.billing_plan set features = features || '{"custom_domain": true}'::jsonb  where id in ('org', 'beta');
update public.billing_plan set features = features || '{"custom_domain": false}'::jsonb where id in ('free', 'starter', 'pro');
