-- One LIVE consent per person, purpose AND TEXT VERSION (2026-10-13).
--
-- Sjoerd's own staging join wrote TWO member_directory consent records 84
-- milliseconds apart. One human act, two rows: `setDirectoryListing` reads
-- "was this listed?" and then inserts, and the two webhooks that converge on
-- `ensureMemberFromSubscription` arrive together — both read false, both
-- insert. The unit test that says "a second yes does not pretend to be a
-- second consent" passes, because it is sequential; concurrency is what it
-- never saw.
--
-- A read-then-write cannot fix this in application code, so the database
-- keeps the rule. The writer treats 23505 as success (lib/directory-consent.ts):
-- losing that race means somebody else recorded the same consent.
--
-- WHY text_version IS IN THE KEY. Without it, a member accepting terms v2
-- would hit this index, the writer would call it success, and THE v2
-- ACCEPTANCE WOULD NEVER BE RECORDED — an evidence table silently dropping
-- the evidence, which is worse than no index at all. A consent is to a TEXT:
-- the same person agreeing to the same words twice in one instant is a
-- duplicate; agreeing to NEW words is a new fact. (Caught in review before
-- this shipped, with the terms panel in mind.)
--
-- WHY `where revoked_at is null`: a person may consent, withdraw, and consent
-- again to the same text — three rows, two of them history. Only one may be
-- live.
--
-- COALESCE because text_version is nullable and NULLs do not collide in a
-- unique index: without it, two rows with no version would both be allowed,
-- which is exactly the race for every older consent kind.
--
-- Duplicates must be gone before this can be created:
--   node apps/api/scripts/dedupe-consent-records.mjs staging|prod [--apply]
-- (a script, never a migration — a data conversion belongs to one database at
-- a time with a human reading the counts in between.)
create unique index if not exists consent_one_live_per_version_idx
  on public.consent_record (person_id, purpose_code, coalesce(text_version, ''))
  where revoked_at is null;

comment on index public.consent_one_live_per_version_idx is
  'One live consent per (person, purpose, text version). The writers race — two webhooks can record the same consent in the same instant — and a read-then-write in application code cannot prevent that, so callers treat 23505 here as success. The text version is part of the key on purpose: a new version of the words is a NEW consent and must be recordable.';
