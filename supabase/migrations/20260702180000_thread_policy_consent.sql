-- Privacy-policy acceptance at public enrolment (Sjoerd 2026-07-02).
-- The accepted policy version + timestamp live on the enrolment (v3 kept
-- consent_version on registrations). The policies themselves are a
-- versioned list in apps/thread/lib/policies.ts.
alter table public.thread_enrolment
  add column policy_version text,
  add column policy_accepted_at timestamptz;
