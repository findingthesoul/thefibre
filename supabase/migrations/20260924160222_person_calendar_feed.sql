-- person_calendar_feed
--
-- One subscribable calendar address per visitor, so a person can follow every
-- session they are enrolled in instead of downloading one .ics at a time —
-- and so a rescheduled session corrects itself in their calendar rather than
-- leaving them at the old time.
--
-- ---------------------------------------------------------------------------
-- WHY THE TOKEN IS THE WHOLE SECURITY MODEL
-- ---------------------------------------------------------------------------
-- A calendar client (Google, Apple, Outlook) fetches a URL on a schedule from
-- its own servers. It carries no cookie, no bearer, no session — it cannot be
-- made to. Every calendar subscription on the internet therefore works the
-- same way: a long random string in the URL IS the credential. We do not get
-- to invent a better scheme here; we get to handle the one that exists
-- carefully.
--
-- So:
--   * 256 bits of randomness, hex — not guessable, not enumerable.
--   * Stored as sha256, never in plaintext. A database read does not hand
--     anybody a working subscription; losing the DB does not leak agendas.
--   * Revocable. `revoked_at` retires an address the moment a person asks,
--     and minting a new one is one button. A URL that ends up in a shared
--     family calendar is a foreseeable accident, not an exotic one.
--   * Opt-in. No row exists until the person asks for the address, so nobody
--     has a secret URL they were never told about.
--
-- ---------------------------------------------------------------------------
-- WHY THE KEY IS THE EMAIL
-- ---------------------------------------------------------------------------
-- The portal itself is keyed on the verified email, not on a person row:
-- one human is a `person` row in every workspace that knows them, and the
-- whole point of my.thethread.app is to compose across those. The feed shows
-- exactly what the portal shows, so it is scoped by exactly what the portal
-- is scoped by. Anything else would be a second, drifting definition of "who
-- this is".
--
-- citext, matching public.person.email, so case is not a way to mint a second
-- feed for the same human.
-- ---------------------------------------------------------------------------

create table if not exists public.person_calendar_feed (
  id           uuid primary key default gen_random_uuid(),
  email        citext not null,
  token_hash   text   not null,
  created_at   timestamptz not null default now(),
  -- Observability for the person, not for us: "last collected 3 hours ago"
  -- is the only way to answer "is my calendar actually following this?".
  last_read_at timestamptz,
  revoked_at   timestamptz
);

-- One LIVE address per person. Revoked rows are kept — they are the record of
-- an address that was once handed out — so uniqueness is partial.
create unique index if not exists person_calendar_feed_live_email_idx
  on public.person_calendar_feed (email)
  where revoked_at is null;

-- The lookup the feed does on every fetch, and the guarantee that two rows
-- can never answer to one address.
create unique index if not exists person_calendar_feed_token_hash_idx
  on public.person_calendar_feed (token_hash);

alter table public.person_calendar_feed enable row level security;
-- No policies on purpose: this is a credential table, service-role only,
-- the same treatment as user_connection and app_key. Nobody reads it through
-- PostgREST, and a visitor has no RLS identity in these workspaces anyway.
