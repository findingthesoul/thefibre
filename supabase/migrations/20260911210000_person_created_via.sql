-- ============================================================================
-- person.created_via — how a person row came to exist.
--
-- Nine call sites across six route files create people: the contacts form,
-- Meet bookings and invites, Thread enrolment and organiser-added
-- participants, workspace member invites, public membership joins and
-- purchases, and external apps through /apps links. Until now none of them
-- recorded which one it was, so there is no way to tell a row somebody typed
-- from a row a booking manufactured — and no way to undo a bad batch.
--
-- Deliberately a plain nullable text column and NOT a check constraint: the
-- vocabulary lives in lib/resolve-person.ts (PersonSource) and adding a
-- source should be a deploy, not a migration — the same call made for app
-- key scopes in v0.14.0. Existing rows stay null, which is honest: we do not
-- know how they arrived.
--
-- This is metadata about the record rather than about the person, but it is
-- attached to their row, so it joins the Article 15 export alongside
-- created_at (routes/privacy.ts).
-- ============================================================================

alter table public.person
  add column if not exists created_via text;

comment on column public.person.created_via is
  'How this row was created — see PersonSource in apps/api/src/lib/resolve-person.ts. Null for rows predating v0.69.x. Vocabulary is application-level on purpose; adding a value is a deploy, not a migration.';

-- Duplicate hunting. person_email_idx already covers (workspace_id, email)
-- for the lookup; this partial index makes "which addresses appear twice"
-- cheap for the sweep without pretending the column is unique. It cannot be:
-- couples share an address and info@ is one mailbox for a whole organisation,
-- which is why resolvePerson() enforces with judgement instead.
create index if not exists person_email_dupe_idx
  on public.person (workspace_id, email)
  where deleted_at is null and email is not null;
