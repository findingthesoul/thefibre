-- thread_handover_batch
--
-- Handover v2 (coordinator, on the plan approved 2026-10-16): an admin hands
-- ALL the threads of an organiser who has LEFT the workspace to one new
-- organiser in one request. A batch is nothing new: N ordinary
-- thread_organiser_handover rows, one per thread, sharing a batch_id. Each
-- row keeps its own status, expiry and keep_as_host and is accepted by the
-- unchanged accept_thread_handover, so there is one accept path. Null = a
-- single-thread request, as before.
--
-- Additive only: a nullable column and an index. No data is touched.

alter table public.thread_organiser_handover
  add column if not exists batch_id uuid;

create index if not exists thread_organiser_handover_batch
  on public.thread_organiser_handover (batch_id) where batch_id is not null;
