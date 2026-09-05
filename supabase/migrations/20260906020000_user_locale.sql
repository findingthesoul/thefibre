-- i18n P2 (docs/i18n-proposal.md §3 P2, D1 decided 2026-09-05): ONE
-- user-level language for the signed-in Fibre interface, durable copy on
-- the profile row (cookies die; this backfills the fibre.locale cookie).
--
-- The proposal wrote "user_profile.locale", but since 20260901160000 the
-- profile SPoT is identity_profile (keyed by email, per-person not
-- per-seat) — user_profile is a read-only legacy fallback that nothing
-- writes. A locale on user_profile could never be saved from Settings →
-- Profile, so the column lands where the profile actually lives.
--
-- Nullable on purpose: null = no preference set → surfaces fall back to
-- their own default (today: English; browser detection is a P3 concern).
-- CHECK mirrors LOCALES in packages/shared/src/i18n.ts — adding a locale
-- there means a FRESH migration widening this constraint (never edit an
-- applied one).

alter table public.identity_profile
  add column locale text
    check (locale in ('en', 'nl', 'es', 'pt', 'de', 'fr'));
