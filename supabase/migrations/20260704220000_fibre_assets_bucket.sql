-- Public bucket for user-facing assets uploaded via the API (profile photos
-- and similar). Writes go through the API with the service role; public read
-- via the bucket's public flag. Thread keeps its own thread-assets bucket.
insert into storage.buckets (id, name, public)
values ('fibre-assets', 'fibre-assets', true)
on conflict (id) do nothing;
