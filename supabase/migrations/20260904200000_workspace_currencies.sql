-- Multi-currency, workspace-level SPoT (Sjoerd, 2026-09-04: "single point
-- of truth on workspace level"). The workspace declares which currencies
-- it sells in and the default for new priced things — Membership tiers /
-- products first, any app later. Same arrangement as payments and brand:
-- the platform value is the truth, app-local currency columns
-- (pulse_settings.currency, tier.currency) are content stamped at pricing
-- time, not configuration.
--
-- Organiser-level override (a person selling in their own currency) is
-- deliberately NOT a column yet — when needed it follows the
-- payment-accounts chain (personal value first, workspace fallback).
alter table public.workspace
  add column if not exists default_currency text not null default 'EUR',
  add column if not exists currencies text[] not null default '{EUR}';
