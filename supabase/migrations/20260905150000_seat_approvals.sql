-- Seat approvals (Sjoerd, 2026-09-05: "if the seats are gone, it means an
-- approval for an extra seat… the company needs to auto-accept or approve,
-- and needs to approve that it pays per seat above the plan").
--
-- The access journal gains 'awaiting_approval': a fibre_seat grant parks
-- there instead of silently provisioning (and NEVER silently bills — a
-- seat above the allowance requires the standing consent below, or a
-- per-member Approve click which provisions synchronously).

alter table public.membership_member_access
  drop constraint if exists membership_member_access_status_check;
alter table public.membership_member_access
  add constraint membership_member_access_status_check
  check (status in ('pending', 'awaiting_approval', 'granted', 'revoke_pending', 'revoked', 'error'));

alter table public.membership_settings
  -- 'approve': every seat grant waits for a human. 'auto': free-allowance
  -- seats provision on the tick; billed seats still need the consent below.
  add column if not exists fibre_seat_mode text not null default 'approve'
    check (fibre_seat_mode in ('auto', 'approve')),
  -- Standing consent: "yes, seats above the plan allowance may be billed."
  add column if not exists allow_billed_seats boolean not null default false;
