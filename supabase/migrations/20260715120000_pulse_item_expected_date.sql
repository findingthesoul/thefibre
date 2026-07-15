-- Per-offering-row expected payment date (Pulse 0.26.0, Sjoerd 2026-07-15:
-- "if it has multiple payments per project, there should be a date added at
-- row level"). Optional: when 2+ offering rows carry their own date, the
-- commitment fans out into one payment line per distinct date; a single
-- shared date (or none) stays one payment on the commitment's Expected date.
-- The date drives the payment SCHEDULE (lines) at save time — the projection
-- keeps reading lines, so nothing downstream changes. Nullable = "use the
-- commitment's Expected date".
alter table pulse_commitment_item
  add column if not exists expected_date date;

comment on column pulse_commitment_item.expected_date is
  'Optional per-row expected payment date. Set on 2+ rows to split a project into one payment line per date; null inherits the commitment Expected date.';
