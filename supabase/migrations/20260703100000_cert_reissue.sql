-- Certificate reissue (Sjoerd 2026-07-03): the explicit exception to
-- immutability. Reissuing regenerates the snapshot from the CURRENT template
-- while keeping the certificate number, recipient and issue date — shared
-- verification links keep working. The marker makes the correction auditable.
alter table public.thread_certificate
  add column reissued_at timestamptz;
