-- ============================================================================
-- An organisation is known by more than one name (Sjoerd, 2026-09-14).
--
-- "Organisation should have extra fields for tradenames or abbreviations.
-- For example: the European Bahá'í Business Forum is now Ethical Business
-- Building the Future, or ebbf."
--
-- That example is three different kinds of name at once — a former name, the
-- current name, and an abbreviation — and the table could already hold two of
-- them, badly:
--
--   name         the current name. Fine.
--   short_name   the abbreviation. Present since the phase-0 schema, and EBBF's
--                row already says "EBBF" — but no form edits it, the API update
--                schema does not accept it, and search does not read it. A
--                column that exists and cannot be reached.
--   legal_name   editable, but not searched.
--
-- What was missing entirely is a place for the rest: other trade names, and
-- the names an organisation used to have. People search for the name they
-- remember, which for a renamed organisation is usually the old one.
--
-- Which app justifies the field (brief §15)? None, and that is the point: a
-- name is IDENTITY, which the platform owns (brief §2), and recognising an
-- organisation by any of its names is something every app that shows one
-- needs. It is not curator data about the organisation; it is what the
-- organisation is called.
-- ============================================================================

-- 1. The names that are not the current one: trade names and former names.
--    One flat list, deliberately untyped. "Former" vs "trade name" is a
--    distinction nobody has asked to filter on, and a typed list would ask
--    every person entering one to classify it first.
alter table public.organisation
  add column if not exists other_names text[] not null default '{}';

comment on column public.organisation.other_names is
  'Other names this organisation is known by: trade names and former names. The current name is `name`, the abbreviation is `short_name`. All of them are searchable through search_names.';

-- 2. One searchable string, kept in step by a trigger.
--
--    PostgREST can ilike a text column but not the elements of an array, and
--    search has to find "European Bahá'í Business Forum" inside other_names.
--    A generated column would be the obvious tool, but array_to_string is not
--    IMMUTABLE, so Postgres refuses it there. A plain trigger does the same
--    job. It is NOT security definer: it only reads the row it is writing, so
--    it needs no grant (20260914171000 — functions are born closed).
alter table public.organisation
  add column if not exists search_names text not null default '';

comment on column public.organisation.search_names is
  'Lower-cased name, short_name, legal_name, other_names and domain, space-separated. Machine state for search: maintained by organisation_search_names_sync, never written by hand.';

create or replace function public.organisation_search_names_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_names := lower(concat_ws(' ',
    new.name,
    new.short_name,
    new.legal_name,
    array_to_string(new.other_names, ' '),
    new.domain
  ));
  return new;
end;
$$;

drop trigger if exists organisation_search_names_sync on public.organisation;
create trigger organisation_search_names_sync
  before insert or update of name, short_name, legal_name, other_names, domain
  on public.organisation
  for each row execute function public.organisation_search_names_sync();

-- 3. Backfill every existing row. The trigger fires on UPDATE of the watched
--    columns, so touching `name` with its own value computes search_names
--    without changing anything a person can see.
update public.organisation set name = name;

-- 4. Search reads it with a contains-match, which a b-tree cannot serve. The
--    table is small today; a pg_trgm GIN index is the upgrade when it is not,
--    and it is left out rather than added speculatively.
