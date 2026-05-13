-- ============================================================================
-- Relax NOT NULL on profile-table columns the UI treats as optional.
--
-- The original schema declared these `text[] NOT NULL DEFAULT '{}'` or
-- `integer NOT NULL DEFAULT 0`. The defaults still apply on INSERT, but when
-- the UI sends `null` to clear a value the upsert rejects with 23502. The
-- brief (§5) doesn't require NOT NULL on these — that was over-tightening.
-- ============================================================================

-- text[] columns ------------------------------------------------------------
alter table public.person_professional
  alter column expertise_areas      drop not null,
  alter column industries_worked_in drop not null,
  alter column certifications       drop not null,
  alter column spoken_at_events     drop not null;

alter table public.person_change_context
  alter column change_themes drop not null,
  alter column blockers      drop not null,
  alter column motivators    drop not null;

alter table public.person_learning
  alter column learning_interests drop not null,
  alter column prior_programmes   drop not null;

alter table public.org_identity
  alter column stated_values          drop not null,
  alter column cultural_descriptors   drop not null,
  alter column languages_of_operation drop not null;

alter table public.org_system_context
  alter column active_change_themes  drop not null,
  alter column structural_tensions   drop not null,
  alter column previous_interventions drop not null,
  alter column blockers              drop not null,
  alter column enablers              drop not null;

alter table public.org_relationship
  alter column programmes_completed drop not null;

alter table public.organisation
  alter column operating_countries drop not null;

alter table public.person
  alter column languages_spoken drop not null;

-- integer counter columns ---------------------------------------------------
alter table public.org_relationship
  alter column total_participants_reached drop not null,
  alter column touchpoints_count          drop not null;
