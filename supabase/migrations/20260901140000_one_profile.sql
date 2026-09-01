-- ============================================================================
-- One profile, one page.
--
-- Sjoerd, 2026-09-01: "It should be exactly the same page.. not different
-- pages with the same content." He is right, and sharing a component was only
-- half the answer — two URLs that edit the same person are still two places to
-- keep in step, and the one that gets forgotten is where the drift starts.
--
-- So the platform profile becomes the only editor, and the apps keep only what
-- is genuinely theirs: the ADDRESS of their public page (thread_organiser.slug,
-- meet_host.slug).
--
-- Before this migration the apps' own columns won: thread_organiser.photo_url
-- ?? user_profile.photo_url. Sjoerd's face was on his organiser row and his
-- platform profile was empty, which is exactly what he was looking at when he
-- said the pages were not the same.
--
-- Two steps, in this order:
--   1. fill the platform profile from whatever the apps already hold, so
--      nothing on a public page changes appearance;
--   2. clear the app overrides, so there is one value and it lives in one
--      place.
--
-- WHAT THIS COSTS: an organiser who deliberately used a different name or
-- photo on their public page than on their platform profile loses that
-- distinction. Today that is nobody — the values are the same person's, set
-- once, in whichever app they happened to be in.
-- ============================================================================

-- 1a. Everyone with app-level profile data needs a platform profile row.
insert into public.user_profile (user_id, display_name)
select u.id, u.full_name
  from public."user" u
 where u.deleted_at is null
   and not exists (select 1 from public.user_profile p where p.user_id = u.id)
   and (
     exists (select 1 from public.thread_organiser o where o.user_id = u.id)
     or exists (select 1 from public.meet_host h where h.user_id = u.id)
   );

-- 1b. Fill the empties from The Thread, then from Meet. Only nulls are
-- touched: a platform value that already exists is the one the person set
-- most deliberately.
update public.user_profile p
   set display_name = coalesce(p.display_name, o.display_name),
       bio          = coalesce(p.bio,          o.bio),
       photo_url    = coalesce(p.photo_url,    o.photo_url),
       timezone     = coalesce(p.timezone,     o.timezone)
  from public.thread_organiser o
 where o.user_id = p.user_id;

update public.user_profile p
   set bio       = coalesce(p.bio,       h.bio),
       photo_url = coalesce(p.photo_url, h.photo_url),
       timezone  = coalesce(p.timezone,  h.timezone)
  from public.meet_host h
 where h.user_id = p.user_id;

-- 2. The overrides go quiet. The columns stay — they are read fallbacks for
-- anything that appears before the next deploy, and dropping columns to tidy
-- up is how you lose data you turn out to need.
update public.thread_organiser set display_name = null, bio = null, photo_url = null;
update public.meet_host          set bio = null, photo_url = null;

comment on column public.thread_organiser.display_name is
  'DEPRECATED read fallback. The name comes from user_profile (one profile, one page — 20260901140000). Do not write.';
comment on column public.thread_organiser.photo_url is
  'DEPRECATED read fallback. The photo comes from user_profile. Do not write.';
comment on column public.thread_organiser.slug is
  'The address of this organiser''s public page. Genuinely The Thread''s own — a platform profile is not a page and has no URL.';
