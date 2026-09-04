-- ============================================================================
-- The VAT module's rate table (Sjoerd, 2026-09-04: "build a VAT module so we
-- can update it regularly"). One platform_setting row: EU-27 standard rates
-- in percent, plus the rules the platform applies on rails Stripe Tax does
-- not cover (invoice-method, future PSPs). Stripe Tax stays the calculator
-- on card rails; THIS is the reference the operator maintains at /admin/vat.
--
-- Seeded with the standard rates as known 2026-09; VERIFY against official
-- sources before invoicing a new country — that is exactly what the editor
-- exists for.
-- ============================================================================

insert into public.platform_setting (key, value)
values ('vat_rates', '{
  "home_country": "NL",
  "eu_b2b_reverse_charge": true,
  "rates": {
    "NL": 21, "BE": 21, "DE": 19, "FR": 20, "ES": 21, "IT": 22, "IE": 23,
    "PT": 23, "AT": 20, "DK": 25, "SE": 25, "FI": 25.5, "PL": 23, "CZ": 21,
    "SK": 23, "SI": 22, "HR": 25, "HU": 27, "RO": 21, "BG": 20, "GR": 24,
    "EE": 24, "LV": 21, "LT": 21, "LU": 17, "CY": 19, "MT": 18
  }
}'::jsonb)
on conflict (key) do nothing;
