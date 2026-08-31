-- ============================================================================
-- Whose email is this? — workspace branding, sender, and the organiser's own
-- words inside the two enrolment emails.
--
-- Sjoerd, 2026-08-31, on receiving three emails for one enrolment: the first
-- and third are the platform's ("request received", "you're enrolled" + QR),
-- compiled into the API in five languages and editable nowhere. The second
-- exists ONLY because the other two cannot be written in. Give him a way into
-- them and the middle email stops being necessary.
--
-- Two levels, because he asked for "a default setting for account": the
-- workspace sets it once, a thread may override it. Null at the thread means
-- inherit — the same shape as payment methods (20260704180000).
--
-- WHY THE SENDER IS TWO COLUMNS
-- email_from_name is free: a mailbox shows the display name, and nothing has
-- to be verified for "Festival of Trust <noreply@thefibre.app>" to arrive
-- looking like the festival's own mail.
--
-- email_from_address is NOT free. Resend refuses any address on a domain that
-- has not been verified with SPF and DKIM records at the registrar. So the
-- column is nullable and the sender falls back to the platform address on
-- refusal (lib/email/client.ts) — a workspace that fills it in before doing
-- the DNS gets its mail delivered, not swallowed.
-- ============================================================================

alter table public.workspace
  add column if not exists brand_logo_url     text,
  add column if not exists email_from_name    text,
  add column if not exists email_from_address text,
  add column if not exists email_reply_to     text,
  add column if not exists enrolment_note     text;

comment on column public.workspace.brand_logo_url is
  'Logo shown at the top of this workspace''s outgoing email, in place of The Fibre wordmark. Null = the platform''s.';
comment on column public.workspace.email_from_name is
  'Display name on outgoing email, e.g. "Festival of Trust". Needs no DNS: the address behind it can stay the platform''s.';
comment on column public.workspace.email_from_address is
  'Sender address, e.g. hello@festivaloftrust.com. Only works once that domain is verified in Resend; sends fall back to the platform address if it is refused.';
comment on column public.workspace.email_reply_to is
  'Where replies go. Unlike the from address this needs no verification, so it is the cheap way to be reachable under your own domain.';
comment on column public.workspace.enrolment_note is
  'The organiser''s own words, shown inside the request-received and enrolled emails. Default for every thread in the workspace.';

alter table public.thread_thread
  add column if not exists enrolment_note text;

comment on column public.thread_thread.enrolment_note is
  'This thread''s version of the note. Null = inherit the workspace default; empty string = deliberately none.';
