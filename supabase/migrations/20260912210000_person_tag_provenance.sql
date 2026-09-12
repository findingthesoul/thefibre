-- ============================================================================
-- Where a tag on a person came from.
--
-- Sjoerd, 2026-09-12: *"if you type something after a visit or conversation,
-- that it would integrate tags in the text... which connects things (without
-- you having to do it)."*
--
-- `tag` and `person_tag` have existed since the first migration and are read
-- by nothing but the Article 15 export — modelled on day one, waiting for a
-- reason. This is the reason. connections-model.md §3.5 already settled that
-- user-defined characteristics ARE tags rather than custom fields, so nothing
-- new is being invented here; what was missing is provenance.
--
-- Three columns, and each earns itself:
--
--   created_at   `person_tag` has always been a bare (person_id, tag_id) pair
--                with no time on it. Every other axis in Connections can
--                answer "what did this look like a month ago" because its
--                sources are timestamped events; a tag without a date is a
--                fact with no history, so a tag-shaped landscape axis could
--                never show movement. Existing rows get the epoch rather than
--                now(), because backdating them to today would invent a
--                stampede of arrivals that never happened.
--
--   created_via  How it got here — 'manual', 'note'. Plain text with no CHECK,
--                the same rule as person.created_via: a CHECK makes adding a
--                source a schema migration, and the vocabulary belongs with
--                the code that writes it. Without this there is no way to
--                tell a tag somebody chose from one a sentence produced, and
--                those deserve different trust.
--
--   note_id      Which note produced it, when one did. This is what makes an
--                automatic tag answerable: "why is this person tagged
--                sdg13?" has to lead back to the sentence, or the tag is an
--                assertion nobody can check. Nullable, and ON DELETE SET NULL
--                rather than CASCADE — deleting the note should not silently
--                retract a tag somebody has since seen and relied on.
--
-- Deliberately NOT here: any automatic writing. The detection runs in the
-- composer, the person watching sees chips and can remove any of them, and
-- the API applies the list it is given. Nothing in the database infers a tag
-- from prose. See connections-data-integrity.md §9.5 — note bodies are the
-- most sensitive text in the system and nothing sends them anywhere.
-- ============================================================================

alter table public.person_tag
  add column if not exists created_at  timestamptz not null default now(),
  add column if not exists created_via text,
  add column if not exists note_id     uuid references public.flow_run_note(id) on delete set null;

-- Rows that predate this migration have no honest timestamp. The epoch says
-- "before records began", which is true, and keeps them out of every
-- since-window without pretending they arrived today.
update public.person_tag
   set created_at = 'epoch'::timestamptz
 where created_at >= now() - interval '1 minute'
   and created_via is null;

comment on column public.person_tag.created_via is
  'How this tag landed on this person: manual, note. Plain text — the vocabulary lives in the code that writes it, never in a CHECK.';
comment on column public.person_tag.note_id is
  'The note whose text produced this tag, when one did. An automatic tag has to lead back to the sentence that caused it.';

-- Reading "which tags does this workspace use, and on how many people" is the
-- one query the tag surfaces make, and it walks person_tag by tag.
create index if not exists person_tag_tag_idx on public.person_tag (tag_id);
create index if not exists person_tag_note_idx on public.person_tag (note_id) where note_id is not null;

-- ---------------------------------------------------------------------------
-- A tag that names an organisation.
--
-- Sjoerd, same conversation: *"e.g. company names are tags (if they exist; if
-- not you can create it)"*. Writing "met them at EBBF" should connect this
-- person to everyone else who has EBBF in their story, and EBBF is not an
-- arbitrary word — it is an organisation this workspace already holds, with a
-- profile, members and a history.
--
-- ONE mechanism, not two. The alternative was a second kind of mention with
-- its own table, its own surfaces and its own rules, and connections-model.md
-- §3.5 already decided that user-defined characteristics ARE tags rather than
-- a parallel taxonomy. So an organisation seeds the vocabulary and the tag
-- carries a pointer back to it: the tag behaves exactly like every other tag
-- everywhere, and where the pointer exists a surface can offer the profile.
--
-- Nullable and ON DELETE SET NULL: a soft-deleted organisation should not
-- retract a tag people have been reading, it should just stop being a link.
-- Unique per workspace so two tags cannot both claim the same organisation,
-- which would split its people into two groups that look unrelated.
-- ---------------------------------------------------------------------------
alter table public.tag
  add column if not exists organisation_id uuid references public.organisation(id) on delete set null;

create unique index if not exists tag_organisation_uniq
  on public.tag (workspace_id, organisation_id)
  where organisation_id is not null;

comment on column public.tag.organisation_id is
  'The organisation this tag names, when it names one. Lets "met them at EBBF" connect people through a real entity instead of a loose word, without a second kind of mention.';
