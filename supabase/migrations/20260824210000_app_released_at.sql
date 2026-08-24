-- ---------------------------------------------------------------------------
-- app.released_at — "does this app actually exist yet?"
--
-- `status` (pending → approved → suspended) is about REVIEW: has a human
-- looked at this registration and allowed it to act. Fibre Sales and Fibre
-- Learn are approved in that sense — they are ours, they are legitimate, their
-- curator tables and RLS policies have shipped — but neither has a product
-- behind it. They are placeholders from the phase-0 seed.
--
-- Today a workspace admin can switch either of them on. The toggle works, the
-- row lands in workspace_app, and the workspace now "has" an app that will
-- never render a page. That is a lie the UI tells, and the catalogue is the
-- only place to stop telling it.
--
-- Not folded into `status` on purpose: an unbuilt app is not un-reviewed, and
-- overloading `status` would mean the app review UI and this concept fight over
-- the same column. Two questions, two columns.
--
-- Not a hardcoded list in the API or the web app either — that is the exact
-- mistake v0.14.0 removed with the slug allow-list. If you want to know which
-- apps are real, ask the catalogue.
--
-- null       = not built yet. Cannot be activated on a workspace.
-- timestamp  = live, and when it became live.
-- ---------------------------------------------------------------------------

alter table public.app
  add column if not exists released_at timestamptz;

comment on column public.app.released_at is
  'When this app became a real, usable product. NULL = not built yet: it shows in the catalogue as unreleased and workspace activation is refused. Distinct from status, which is about review, not existence.';

-- Everything that exists today is released. Third-party apps are released by
-- definition — somebody wrote them before registering them.
update public.app
   set released_at = coalesce(released_at, created_at, now())
 where slug not in ('fibre-sales', 'fibre-learn');

-- The two placeholders. Explicit rather than "whatever is left", so that a new
-- app added later does not silently inherit "unreleased" from this migration.
update public.app
   set released_at = null
 where slug in ('fibre-sales', 'fibre-learn');
