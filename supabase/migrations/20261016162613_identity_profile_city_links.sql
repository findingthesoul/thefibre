-- ONE PROFILE gains a city and two links (Sjoerd, 2026-10-16: "The profile
-- here is the same profile as people would have in the Thread. Not a new
-- profile." and "If people later become part of the thread, this profile can
-- also be used.").
--
-- identity_profile is that one profile: keyed by email, written by Settings
-- → Profile in The Fibre/Thread/Meet and, from the next release, by
-- my.thread → You → Profile. A city and a website/LinkedIn link lived only on
-- the per-workspace `person` rows an organiser types ABOUT a contact; the
-- member directory read them there. They belong to the person's own face, so
-- they join it here. The person-row columns stay as the directory's
-- fallback; nothing is copied or moved.
--
-- `id`: a stable, non-identifying handle for the profile, so a stored photo's
-- path never contains the email (profiles/<id>/…). Generated for every
-- existing row; never shown, never an FK target yet.
--
-- Additive: four columns, none required, nothing existing changes. Who may
-- read them is unchanged (identity_profile_read: seat-holders of the same
-- workspace; the API's service-role reads name their columns, and no public
-- payload selects these).
alter table public.identity_profile
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists city text,
  add column if not exists website_url text,
  add column if not exists linkedin_url text;

create unique index if not exists identity_profile_id_key on public.identity_profile (id);

comment on column public.identity_profile.id is
  'Stable non-identifying handle; used in storage paths (profiles/<id>/…) so no path carries an email.';
comment on column public.identity_profile.city is
  'The town the person lives in, as they typed it (FIELD_LIMITS.city). Shown in a member directory only where they are listed.';
comment on column public.identity_profile.website_url is
  'Their own website, http(s) only (FIELD_LIMITS.website).';
comment on column public.identity_profile.linkedin_url is
  'Their LinkedIn profile URL, http(s) only (FIELD_LIMITS.website).';
