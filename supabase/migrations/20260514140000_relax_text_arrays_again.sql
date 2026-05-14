-- Idempotent re-application of "drop NOT NULL on optional text[] columns".
-- The v0.3.9 migration was meant to do this, but the remote DB still rejects
-- saves with `null value in column "stated_values"` etc — likely because that
-- migration was recorded as applied before its body was complete (Supabase
-- tracks migrations by filename, not checksum). Re-issuing the constraint
-- changes here is a no-op when they're already dropped.

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
