-- Accepting terms before paying (2026-10-13).
--
-- Sjoerd, testing the join on staging: "Nowhere, I have accepted terms and
-- conditions." Nobody should be asked for money before they have agreed to
-- what they are buying, and the agreement is between the WORKSPACE and its
-- member — The Thread is the software underneath, not a party to it.
--
-- 1. The consent purpose. A T&C acceptance is a consent record like any
--    other: who, when, and WHICH TEXT. It rides the same table, the same
--    revocation semantics and the same one-live-per-version index added
--    earlier today — which is exactly why that index keys on text_version:
--    terms v2 must be recordable after terms v1.
alter table public.consent_record
  drop constraint if exists consent_record_purpose_code_check;
alter table public.consent_record
  add constraint consent_record_purpose_code_check
  check (purpose_code in (
    'transactional_email',
    'marketing_email',
    'learning_analytics',
    'cohort_directory',
    'facilitation_data',
    'sales_contact',
    'member_directory',
    'terms_of_service'
  ));

-- 2. Whose terms. NULL means The Thread's standard terms — the default, and
--    the safe one: a workspace that has never thought about this still has
--    something reasonable to show, and the standard text says plainly that
--    the agreement is between the workspace and its member.
--
--    One column rather than a mode plus a URL: "has its own" and "uses the
--    standard" are the same question asked twice, and two columns can
--    disagree.
alter table public.workspace
  add column if not exists terms_url text;

comment on column public.workspace.terms_url is
  'The workspace''s own terms and conditions, shown to members before they pay. NULL (the default) means The Thread''s standard terms. Members, Thread and Meet all sell on the workspace''s behalf, so this lives on the workspace rather than in one app.';
