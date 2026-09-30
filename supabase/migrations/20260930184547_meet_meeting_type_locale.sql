-- The language a meeting type speaks to the outside world.
--
-- Sjoerd, 2026-09-30: "Kun je per event de taal instellen? Dus overall taal
-- gebaseerd op profiel? En dan per event type een subtaal instellen." Exactly
-- that shape: your profile language is the default for everything you publish,
-- and this column is the exception for the one meeting type that isn't in it —
-- the English intake call in an otherwise Dutch practice.
--
-- NULL means inherit, and that is the whole point: a workspace that changes
-- its mind about its default should not have to revisit every meeting type.
-- Only a row that says something different carries a value.
--
-- The resolution chain (override -> owner's profile -> visitor -> English)
-- lives in packages/shared/src/locale-resolution.ts, which is the single
-- place any app asks what language a surface is in.
alter table public.meet_meeting_type
  add column if not exists locale text;

comment on column public.meet_meeting_type.locale is
  'Public language override for this meeting type — its booking page and the booking emails. NULL = inherit the host''s own language. Resolved through resolvePublicLocale in @thefibre/shared.';
