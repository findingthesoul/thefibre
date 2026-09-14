-- ============================================================================
-- Organisation search ignores accents and apostrophes (2026-09-14).
--
-- 20260914190000 made every name searchable, and on its first real test it
-- failed the very example that prompted it. "European Bahá'í Business Forum"
-- carries two accents and an apostrophe, and nobody types either into a
-- search box. "bahai" matched nothing.
--
-- So search_names is now stored without accents and without apostrophes, and
-- the API strips the same things from the search term before it asks
-- (routes/organisations.ts, normaliseSearch). Both sides have to agree or the
-- match silently fails, which is exactly how it failed.
--
-- What is stored for display is untouched: `name`, `short_name`,
-- `other_names` keep every accent a person typed. Only the machine column
-- loses them.
-- ============================================================================

create extension if not exists unaccent with schema extensions;

create or replace function public.organisation_search_names_sync()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  -- unaccent, then drop the apostrophe family (straight, typographic and the
  -- modifier letter Bahá'í is often written with), then lower-case.
  new.search_names := lower(
    translate(
      extensions.unaccent(concat_ws(' ',
        new.name,
        new.short_name,
        new.legal_name,
        array_to_string(new.other_names, ' '),
        new.domain
      )),
      '''’ʼ`',
      ''
    )
  );
  return new;
end;
$$;

-- Recompute every row with the new rule.
update public.organisation set name = name;
