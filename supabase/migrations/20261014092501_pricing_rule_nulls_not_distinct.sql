-- A general pricing rule can exist ONCE, which it could not before.
--
-- `membership_pricing_rule` was unique on (workspace_id, kind, tier_id), and
-- Postgres treats NULLs as DISTINCT in a unique index. A GENERAL rule — one
-- that applies to every tier — has `tier_id = NULL`, so
-- `on conflict (workspace_id, kind, tier_id) do update` NEVER conflicted and
-- the route inserted a new row on every save.
--
-- soul.com accumulated six. Both readers then took whichever row came back
-- first from a query with no ORDER BY, and one of those readers decides what
-- somebody is CHARGED: production spent five weeks pricing on a rule set from
-- 7 September while five newer saves sat unread in the same table. Chile and
-- El Salvador were charged 100% where the admin had configured 75%.
--
-- v1.187.2 made the newest row win, which stopped the bleeding and is why
-- this is not urgent. `scripts/dedupe-and-set-price-logic.mjs` removes the
-- duplicates, one database at a time, with the up/down list printed first.
-- This is the third step: making the shape impossible rather than merely
-- tidy, so the next person to press Save twice cannot recreate it.
--
-- NULLS NOT DISTINCT (Postgres 15+) is the whole fix: two rows with the same
-- (workspace_id, kind) and a NULL tier_id now collide, so the route's upsert
-- updates instead of inserting — which is what it always claimed to do.

-- ── Refuse clearly if the duplicates are still there ───────────────────────
--
-- Creating the constraint over duplicate rows fails with a raw
-- `could not create unique index … Key (…)=(…) is duplicated`, which names a
-- key and not a cause, and arrives in the middle of a db push. This says what
-- to do instead, and names the script that does it.
do $$
declare
  dupes int;
  example text;
begin
  select count(*) into dupes from (
    select workspace_id, kind, tier_id
    from public.membership_pricing_rule
    group by workspace_id, kind, tier_id
    having count(*) > 1
  ) d;

  if dupes > 0 then
    select string_agg(format('%s/%s × %s', w.slug, d.kind, d.n), ', ')
      into example
      from (
        select workspace_id, kind, count(*) as n
        from public.membership_pricing_rule
        group by workspace_id, kind, tier_id
        having count(*) > 1
        limit 5
      ) d
      join public.workspace w on w.id = d.workspace_id;

    raise exception using
      message = format(
        'membership_pricing_rule still holds %s duplicated key(s): %s',
        dupes, coalesce(example, '(could not name them)')
      ),
      hint =
        'Run the dedupe FIRST, one database at a time, and read its output: '
        'FIBRE_ENV_FILE=<env> node apps/api/scripts/dedupe-and-set-price-logic.mjs '
        '--workspace <slug> [--policy wb-fy2027] --apply. '
        'It prints every row it would delete and which countries change price '
        'before it touches anything. This migration cannot create the '
        'constraint while the rows it forbids still exist.';
  end if;
end $$;

-- ── The constraint ────────────────────────────────────────────────────────
--
-- Dropped and recreated rather than altered: a unique CONSTRAINT cannot be
-- switched to NULLS NOT DISTINCT in place, and the name is kept so nothing
-- that refers to it has to learn a new one.
alter table public.membership_pricing_rule
  drop constraint if exists membership_pricing_rule_workspace_id_kind_tier_id_key;

alter table public.membership_pricing_rule
  add constraint membership_pricing_rule_workspace_id_kind_tier_id_key
  unique nulls not distinct (workspace_id, kind, tier_id);

comment on constraint membership_pricing_rule_workspace_id_kind_tier_id_key
  on public.membership_pricing_rule is
  'NULLS NOT DISTINCT on purpose: a general rule has tier_id NULL, and with '
  'the default NULLS DISTINCT every save inserted a new row instead of '
  'updating — six of them on soul.com, with the oldest deciding what people '
  'were charged (2026-10-14).';
