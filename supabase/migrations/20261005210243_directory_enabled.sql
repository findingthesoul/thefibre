-- ============================================================================
-- Member directory, slice 3: the workspace SWITCH.
--
-- Slice 1 gave a community its vocabulary, 2a gave a member their choice.
-- This is the community's own on/off, and it exists because of an ordering
-- decision rather than a feature request.
--
-- Sjoerd decided the directory is a PRODUCT — "Community landscape", a
-- feature a package carries (§9.6). That product and its enrolment step are
-- slice 2b, and the list is shipping BEFORE them. Without this column
-- nothing would gate whether the directory exists for a workspace at all, so
-- the list would simply appear for every community with the Members app:
-- on by default, free, everywhere — the opposite of something you buy.
--
-- Default FALSE for the same reason every other switch here defaults to the
-- quiet side: a community that never asked for a directory should not
-- acquire one by being upgraded.
--
-- 2b replaces the manual switch with the real thing. This column survives it
-- as the workspace-level off, which is worth having anyway.
-- ============================================================================

alter table public.membership_settings
  add column directory_enabled boolean not null default false;
