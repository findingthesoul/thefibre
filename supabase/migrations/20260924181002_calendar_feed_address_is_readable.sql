-- calendar_feed_address_is_readable
--
-- Keep the subscription address, so the portal can show it again.
--
-- It was stored as sha256 only, shown once at mint and unrecoverable — the
-- treatment app_key gets, chosen for consistency with it. That was the wrong
-- model for this artefact, and Android is where it broke.
--
-- Google Calendar cannot add a subscription from its phone app; it has to be
-- done on a computer. So an Android user's real flow is: press Subscribe on
-- the phone, then go to a computer. With a write-once address, the address is
-- on the wrong device by then and the only way forward is to mint another one
-- — on the computer, invalidating the one on the phone. The feature was
-- unusable for exactly the person most likely to want it.
--
-- Hashing also bought less here than it does for an app key. An app key is a
-- credential for OTHER data; this URL leads to a person's agenda, which lives
-- in this same database in plain rows. Anyone who can read this table can
-- already read what it protects, so the write-once ceremony cost a working
-- feature and secured nothing new.
--
-- Every calendar service does it the other way — Google, Apple and Outlook
-- all show you your secret address whenever you ask. That is the convention
-- people's habits are built on, and it is the right one.
--
-- What stays: the address is still a credential, still unguessable, still
-- retired the moment a new one is made. `token_hash` stays as the lookup key
-- so the fetch path is unchanged.
--
-- Existing rows keep a null token and cannot be recovered — there is nothing
-- to recover from a hash. The portal shows those as "make a new address",
-- which is the honest offer. Two rows existed when this was written, both
-- already revoked.

alter table public.person_calendar_feed
  add column if not exists token text;

comment on column public.person_calendar_feed.token is
  'The subscription address, readable so the portal can show it again. Null for rows minted before 2026-09-24, which were hash-only.';
