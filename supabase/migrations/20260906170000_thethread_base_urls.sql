-- The thethread.app domain move (v0.52.0): the five delivery apps now live
-- on subdomains of thethread.app; fibre web stays on thefibre.app. In-family
-- links never read app.base_url (they go through appUrl()/branding.ts since
-- v0.39.1), but the admin catalogue displays it — keep it truthful.
-- Reverses the direction recorded at v0.23.1 deliberately (decision:
-- Sjoerd, 2026-09-06).

update public.app set base_url = 'https://app.thethread.app'        where slug = 'the-thread';
update public.app set base_url = 'https://meet.thethread.app'       where slug = 'fibre-meet';
update public.app set base_url = 'https://flow.thethread.app'       where slug = 'fibre-flow';
update public.app set base_url = 'https://pulse.thethread.app'      where slug = 'fibre-pulse';
update public.app set base_url = 'https://membership.thethread.app' where slug = 'membership';
