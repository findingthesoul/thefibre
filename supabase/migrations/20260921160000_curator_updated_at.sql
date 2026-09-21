-- ============================================================================
-- The curator tables say WHEN they were last changed, and mean it.
--
-- Found 2026-09-21 chasing Sjoerd's *"Can it be that the How you know them is
-- not saving?"*. Reading his row on production to answer him, the first thing
-- to check was `updated_at` — and it said 2026-09-16, five days before the
-- writes that had just come through the log. Not because the write failed:
-- because NOTHING has ever set that column after the insert. It carries
-- `default now()`, the API's upsert does not send it, and there was no
-- trigger. Every one of these tables has had a lying timestamp since the
-- first migration.
--
-- That mattered twice over. It cost an hour of a support question, and it
-- would have cost the same hour to anybody else who ever asks "when did this
-- last change" — including the person whose data it is, under an Article 15
-- request.
--
-- One trigger per table rather than a column the API sets, because the API is
-- not the only writer (a migration, a backfill and a support fix are all
-- writers), and a timestamp that is only true when one particular caller
-- remembers to set it is the thing being fixed.
--
-- `person_billing` is deliberately absent: it has no updated_at column at all.
-- Adding one is a different decision (nothing reads it), and a migration that
-- quietly grows a table while fixing a trigger is how a small change becomes
-- an unreviewable one.
-- ============================================================================

-- public.set_updated_at() already exists (20260514170000_meet_schema.sql).

do $$
declare
  t text;
begin
  foreach t in array array[
    'person_professional',
    'person_relationship_context',
    'person_change_context',
    'person_learning',
    'org_identity',
    'org_system_context'
  ]
  loop
    -- Idempotent: the same name is dropped first, so re-running this is safe
    -- and a table that gains the trigger elsewhere is not duplicated.
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end
$$;
