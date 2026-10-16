-- thread_cancellation_request — a participant asks to cancel their place;
-- the organiser decides (Sjoerd's 2iv, plan approved 2026-10-16).
--
-- One row per request. The decision is the organiser's: approve (the place
-- is dropped through the same path as Decline, and — for a card payment, if
-- they tick it — refunded through the same Reimburse as the invoices page) or
-- reject (the place stays; their note goes to the participant). The
-- participant may withdraw while it is pending.
--
-- `thread_id` is carried beside `enrolment_id` so the organiser's list for
-- one thread is a single indexed read; it is the enrolment's thread and never
-- anything else (the API writes both from the same row).
--
-- Staff reach it with the Thread app in their workspace, like
-- thread_enrolment. Participants have no policy: they reach their own
-- requests only through the API, which scopes them by verified email.

create table public.thread_cancellation_request (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  thread_id       uuid not null references public.thread_thread(id) on delete cascade,
  enrolment_id    uuid not null references public.thread_enrolment(id) on delete cascade,
  person_id       uuid references public.person(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  -- The participant's own words, optional.
  reason          text check (reason is null or length(reason) <= 2000),
  -- The organiser's note on a rejection (shown to the participant).
  decision_note   text check (decision_note is null or length(decision_note) <= 2000),
  decided_by      uuid references public."user"(id) on delete set null,
  decided_at      timestamptz,
  -- What went back to the card on an approval with refund; null when none
  -- did (no refund asked, an invoice place, or the refund failed).
  refunded_cents  integer check (refunded_cents is null or refunded_cents >= 0),
  -- Why a refund that was asked for did not happen, for the dialog to say.
  refund_error    text,
  created_at      timestamptz not null default now()
);

-- One open request per place.
create unique index thread_cancellation_request_one_pending
  on public.thread_cancellation_request (enrolment_id)
  where status = 'pending';
create index thread_cancellation_request_thread_idx
  on public.thread_cancellation_request (thread_id, created_at desc);

alter table public.thread_cancellation_request enable row level security;

create policy thread_cancellation_request_scope on public.thread_cancellation_request
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));
