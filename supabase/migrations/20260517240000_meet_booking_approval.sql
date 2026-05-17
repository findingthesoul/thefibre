-- Booking approval flow.
--
-- A meeting type can require host approval before a booking is confirmed.
-- Without approval, the booking sits in `pending_approval` — no Google
-- Calendar event, no Meet link, the invitee gets a "request received" email
-- instead of the standard confirmation. The host gets Approve / Reject
-- actions on the booking; approval flips status to 'confirmed' and runs
-- the normal calendar+email path; reject flips to 'cancelled' with a
-- distinct reason.
--
-- Default lives on meet_host so a facilitator can flip every new MT into
-- "require approval" globally. The MT-level column is nullable — NULL =
-- inherit the host default; true/false = explicit override.

alter table public.meet_host
  add column if not exists requires_approval boolean not null default false;

alter table public.meet_meeting_type
  add column if not exists requires_approval boolean;

comment on column public.meet_host.requires_approval is
  'Default approval policy for new meeting types created by this host.';
comment on column public.meet_meeting_type.requires_approval is
  'NULL = inherit from meet_host.requires_approval; true/false = explicit override.';

-- Extend the booking status enum to include pending_approval.
-- The CHECK constraint can't be ALTERed in place; drop + re-add.
alter table public.meet_booking
  drop constraint if exists meet_booking_status_check;

alter table public.meet_booking
  add constraint meet_booking_status_check
    check (status in ('confirmed', 'cancelled', 'rescheduled', 'pending_approval'));
