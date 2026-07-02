-- Engagement location/conferencing model (Sjoerd 2026-07-02):
-- in-person → location (description) + location_url (map/venue link)
-- virtual   → meeting_provider + meeting_url (Meet's provider vocabulary)
alter table public.thread_engagement
  add column meeting_provider text
    check (meeting_provider in ('google_meet', 'zoom', 'teams', 'personal_room', 'custom')),
  add column location_url text;
