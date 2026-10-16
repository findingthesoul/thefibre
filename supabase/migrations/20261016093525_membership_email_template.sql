-- MEMBER EMAILS, EDITABLE PER COMMUNITY (Sjoerd 2ix, 2026-10-14: "would be
-- great if it was editable in the settings"; plan approved 2026-10-16).
--
-- A community writes its OWN words for:
--   · welcome   — per tier (tier_id), or a community default (tier_id null)
--   · digest    — the calendar digest's intro (tier_id null)
--   · signature — one closing line for the transactional emails (tier_id null)
-- per locale. The FACTS (what was joined, until when, what it includes, how
-- to sign in; the digest's list of sessions; every amount and date in a
-- transactional email) stay the platform's and are always rendered — a
-- community can add its voice, never remove the facts.
--
-- Nothing changes until a row exists: no row = today's emails, byte for byte.
-- A member whose locale was not written gets the community's PAGE-language
-- row (its own words beat our standard text, and one email in two voices
-- reads as broken).
--
-- image_path: an object in the public `fibre-assets` bucket (EU), written only
-- through the API (type + size + signature checked there). intro_html is
-- sanitised server-side on write (the bio_html allow-list).

create table public.membership_email_template (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  kind text not null check (kind in ('welcome', 'digest', 'signature')),
  tier_id uuid references public.membership_tier(id) on delete cascade,
  locale text not null check (locale in ('en', 'nl', 'es', 'pt', 'de', 'fr')),
  subject text check (subject is null or char_length(subject) <= 200),
  image_path text,
  image_alt text check (image_alt is null or char_length(image_alt) <= 200),
  intro_html text check (intro_html is null or char_length(intro_html) <= 20000),
  closing text check (closing is null or char_length(closing) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public."user"(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Only a welcome is per tier.
  constraint membership_email_template_tier_kind check (tier_id is null or kind = 'welcome'),
  -- An image needs words for those who cannot see it.
  constraint membership_email_template_alt check (image_path is null or image_alt is not null)
);

-- One row per (community, kind, tier-or-default, locale). Two indexes,
-- because a unique constraint treats NULL tier_ids as distinct.
create unique index membership_email_template_one_per_tier
  on public.membership_email_template (workspace_id, kind, tier_id, locale)
  where tier_id is not null;
create unique index membership_email_template_one_default
  on public.membership_email_template (workspace_id, kind, locale)
  where tier_id is null;

-- RLS: read and write for a workspace or Members admin only. Members never
-- read this table — they receive the rendered email. Send time reads it with
-- the service role.
alter table public.membership_email_template enable row level security;

create policy membership_email_template_read on public.membership_email_template
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );
create policy membership_email_template_insert on public.membership_email_template
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );
create policy membership_email_template_update on public.membership_email_template
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );
create policy membership_email_template_delete on public.membership_email_template
  for delete to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );
