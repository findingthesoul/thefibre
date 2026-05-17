-- Adds a per-MT "show on personal overview page?" toggle.
--
-- Previously, an MT was either is_active=true (live, listed on the host's
-- /<slug> page and bookable) or is_active=false (hidden everywhere). There
-- was no way to keep an MT bookable via direct link but hide it from the
-- public overview list (e.g. private intros, employer-only links).
--
-- is_public_listed=true (default): MT shows in /api/v1/meet/public/host/:slug
-- is_public_listed=false: MT is still bookable at /<host>/<mt> but the
-- overview list omits it.

alter table public.meet_meeting_type
  add column if not exists is_public_listed boolean not null default true;

comment on column public.meet_meeting_type.is_public_listed is
  'When false, the MT is bookable via direct link but omitted from the public host/team overview list. Pair with is_active to fully hide.';
