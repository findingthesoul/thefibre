-- Drop NOT NULL on optional boolean flags. They default to false on INSERT
-- but null is meaningful on the UI ("unknown / not recorded").
alter table public.person_relationship_context
  alter column is_key_contact drop not null,
  alter column is_ambassador  drop not null;
