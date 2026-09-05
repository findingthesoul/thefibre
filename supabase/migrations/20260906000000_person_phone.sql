-- Phone on the platform person row (Sjoerd, 2026-09-05: a manually added
-- member "should contain phone, address, country + VAT nr from moment
-- one"). Address/country/city/street already exist (v0.4.7); VAT lives in
-- the app-tagged person_billing curator row (now tagged by the CALLING
-- app, so Membership-added VAT is Membership's field). Phone is basic
-- reachability — platform identity, like email.
alter table public.person
  add column if not exists phone text;
