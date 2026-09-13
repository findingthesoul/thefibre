-- ============================================================================
-- Which company, when you met somebody through work.
--
-- Sjoerd, 2026-09-13, looking at "How you met" offering five answers and one
-- follow-up field regardless of which you picked: *"SHould this not be
-- contextuel: At something: what (text) / Introduced: (search: person) / I
-- reached out (nothing) / Through work: (search: company) / They reach out:
-- nothing"*.
--
-- Four of the five are already answerable. `source_detail` is free text and
-- takes "what" for *at something*; `introduced_by` is a person and takes the
-- one for *introduced*; the two "nothing" cases need no column. **Through
-- work has nowhere to put the company.**
--
-- ── Why a column and not `source_detail` ───────────────────────────────────
--
-- The obvious shortcut is to put the company's name in the text field that is
-- already there. That is precisely what handbook §12 forbids: a company
-- chosen from a list is an ENTITY, and writing it down as prose throws away
-- the identifier the person just picked. A year later "Acme" in a text column
-- cannot be joined to the Acme whose people are on the map, cannot follow a
-- rename, and cannot be told apart from a different Acme.
--
-- It is also the difference between this and a tag detected in a sentence: a
-- tag is a hint and may be a word, a membership is a fact and must be an id.
--
-- ── Deliberately NOT org_membership ────────────────────────────────────────
--
-- `org_membership` already says where somebody works, and it is tempting to
-- read "through work" off that instead. They answer different questions. A
-- membership is where they are NOW; this is how you came to know them, which
-- does not change when they move jobs — and the company you met them through
-- is often not the company they are at today. Deriving one from the other
-- would quietly rewrite your own history every time somebody changed employer.
-- ============================================================================

alter table public.person_relationship_context
  add column if not exists via_organisation_id uuid references public.organisation(id);

comment on column public.person_relationship_context.via_organisation_id is
  'The company you met them through, when source = client_contact. An id and never a name: a company picked from a list is an entity (handbook §12). Distinct from org_membership, which is where they work NOW — this does not change when they move.';

-- No index. The column is read one row at a time, on a person already
-- fetched by primary key; an index here would cost writes and earn nothing.
