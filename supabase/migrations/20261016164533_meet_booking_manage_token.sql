-- meet_booking_manage_token
--
-- A Meet booking's MANAGE token (security fix, coordinator 2026-10-16).
--
-- The hole: cancel and reschedule needed nothing but the booking id, and the
-- public GET returned the guest's and the host's email to anyone with it. The
-- id is unguessable — but it is also the calendar UID (meet-<id>@thefibre.app)
-- in every invitation and in the public .ics, so anyone an invitation reaches
-- (a forward, a shared or delegated calendar) held the capability.
--
-- The fix needs, per booking, a SALT for a manage token the API derives:
--   token = base64url(HMAC-SHA256(K, booking_id ‖ manage_salt))
-- with K derived from a server secret (apps/api/src/lib/meet-manage-token.ts).
-- Nothing secret lives here: the salt alone grants nothing. A new salt
-- revokes every outstanding link for that booking.
--
-- And a log of "email me a link to manage this booking" requests, which is
-- also its rate limit (a few per booking per hour). It records WHEN, never
-- who: no address and no IP.
--
-- Additive. Existing bookings get their own random salt in this statement (a
-- volatile default is evaluated per row) — a new random column, not a data
-- conversion.

alter table public.meet_booking
  add column if not exists manage_salt text not null default replace(gen_random_uuid()::text, '-', '');

create table if not exists public.meet_booking_link_request (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.meet_booking(id) on delete cascade,
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  requested_at  timestamptz not null default now(),
  -- Whether a link was actually sent (false when refused by the rate limit
  -- or when the booking has no address to send to).
  sent          boolean not null default false
);

create index if not exists meet_booking_link_request_rate
  on public.meet_booking_link_request (booking_id, requested_at);

alter table public.meet_booking_link_request enable row level security;
-- No policies on purpose: reached only through the API.
