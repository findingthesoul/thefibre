-- Rename Fibre Suite → Fibre Meet.
-- Slug changes from 'fibre-suite' to 'fibre-meet'; subdomain moves to meet.thefibre.app.
-- Idempotent: only acts if the old row exists.

alter table public.app drop constraint if exists app_slug_check;

update public.app
   set slug = 'fibre-meet',
       name = 'Fibre Meet',
       base_url = 'https://meet.thefibre.app'
 where slug = 'fibre-suite';

alter table public.app
  add constraint app_slug_check
  check (slug in ('fibre-platform','fibre-meet','the-thread','fibre-sales','fibre-learn'));
