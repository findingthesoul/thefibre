-- Pay by invoice on Meet (Sjoerd 2026-09-14: "in Suite you can also pay per
-- invoice"). Suite had MeetingType.paymentMethod; Meet only ever had the
-- booking half (meet_booking.payment_method / invoice_details), unused.
--
-- Same inheritance as Thread: NULL = the owner's account default from
-- Settings → Payments (identity_billing / user_profile
-- .default_payment_methods), a non-empty array = this meeting type's own.
alter table public.meet_meeting_type
  add column if not exists payment_methods text[];

alter table public.meet_meeting_type
  drop constraint if exists meet_meeting_type_payment_methods_check;
alter table public.meet_meeting_type
  add constraint meet_meeting_type_payment_methods_check
  check (
    payment_methods is null
    or (cardinality(payment_methods) > 0
        and payment_methods <@ array['stripe', 'invoice']::text[])
  );

comment on column public.meet_meeting_type.payment_methods is
  'How invitees may pay for a paid meeting type: stripe and/or invoice. NULL inherits the owner''s account default.';
