-- ============================================================================
-- Who else was in the conversation.
--
-- Sjoerd, 2026-09-12: *"# for tags is great and @ for people or
-- organisations."*
--
-- `#` already works: it makes a tag, and an organisation name is a tag
-- (20260912210000). `@` for a PERSON is the piece with nowhere to go, because
-- a note points at exactly one person — the one it is about — and somebody
-- mentioned inside it is a different relationship entirely.
--
-- ── Why this is allowed when matching names in prose is not ─────────────────
--
-- v0.73.10 deliberately refuses to match person names inside note text, and
-- that refusal stands. The difference is not the names, it is who decided: a
-- name found by an algorithm is a guess that attaches a claim to a real
-- person's record, while `@` is somebody typing a marker on purpose and
-- choosing from a list. Intent, not inference. The same reason calendar
-- attendees are matched (an exact address) and first names in sentences are
-- not — see system-handbook §12, "attach a person by an EXACT identifier".
--
-- ── Why not reuse tags ──────────────────────────────────────────────────────
--
-- Because people are not words. A tag is a characteristic a person carries;
-- a mention is an event that happened in a sentence. Folding people into
-- `tag` would put "Wilma Doornbos" in the tag cloud next to "outreach",
-- weighted by the rarity rule as though a person were a category — and it
-- would mean renaming a person to rename a tag. Organisations survive being
-- tags because an organisation genuinely IS a characteristic of the people
-- in it; a person is not a characteristic of another person.
--
-- ── What it is NOT ──────────────────────────────────────────────────────────
--
-- Not a relationship edge. `relationship` records that two people know each
-- other in a stated way, and the contribution axis reads it for
-- introductions. Being named in the same note is far weaker than that, and
-- promoting it would quietly inflate an axis that is supposed to mean
-- something. Derived closeness can read mentions later if it earns it; the
-- edge stays a thing somebody states.
-- ============================================================================

create table if not exists public.flow_run_note_mention (
  note_id    uuid not null references public.flow_run_note(id) on delete cascade,
  person_id  uuid not null references public.person(id) on delete cascade,
  -- Carried rather than joined through the note, because every read of this
  -- table filters by workspace and the join would be a second hop on a hot
  -- path. Denormalised on purpose; the note's workspace is the source.
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, person_id)
);

comment on table public.flow_run_note_mention is
  'Someone named with @ inside a note that is about somebody else. An intentional mark, never inferred from prose — see v0.73.10, which refuses to match person names automatically. Not a relationship edge: being in the same sentence is weaker than knowing each other.';

create index if not exists flow_run_note_mention_person_idx
  on public.flow_run_note_mention (person_id, created_at desc);
create index if not exists flow_run_note_mention_workspace_idx
  on public.flow_run_note_mention (workspace_id, created_at desc);

alter table public.flow_run_note_mention enable row level security;

-- Same gate as the note itself: a mention is part of a note, and anyone who
-- can read the note can read who was in it. Flow-app-gated for the same
-- reason flow_run_note is — the notes live in that app's table.
drop policy if exists flow_run_note_mention_scope on public.flow_run_note_mention;
create policy flow_run_note_mention_scope on public.flow_run_note_mention
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  );
