-- workspace_domain_web_target
--
-- A web host shows ONE thing: the booking pages of one Meet host or team, or
-- the event pages of one Thread owner (docs/domain-package.md, part 2). So a
-- `web` row names the app it is attached to (the Vercel project follows from
-- it) and the owner's root slug the middleware prefixes paths with:
-- book.soul.com/ → /{root_slug}. An `email` row has neither.

alter table public.workspace_domain
  add column app       text check (app in ('fibre-meet', 'the-thread')),
  add column root_slug text;

alter table public.workspace_domain
  add constraint workspace_domain_web_target_chk check (
    (kind = 'email' and app is null and root_slug is null) or
    (kind = 'web'   and app is not null and root_slug is not null)
  );

comment on column public.workspace_domain.app is
  'web rows: which app serves this host (decides the Vercel project). null for email rows.';
comment on column public.workspace_domain.root_slug is
  'web rows: the owner root the middleware prefixes paths with (Meet host/team slug, Thread public_root_slug). null for email rows.';
