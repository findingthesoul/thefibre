-- Membership ships: flip the catalogue latch. The schema migration
-- deliberately left released_at NULL (catalogued, activation refused);
-- this runs in the release that deploys the frontend, so the Settings →
-- Apps toggle starts working the moment the app exists to open.
update public.app
   set released_at = now()
 where slug = 'membership'
   and released_at is null;
