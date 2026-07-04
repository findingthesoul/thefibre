-- Sjoerd 2026-07-04: "why are the discount people not in the invoices list?"
-- Decision: €0-via-discount-code enrolments ARE purchases (method 'free',
-- amount 0, settled). Widen the check and backfill the existing ones.
alter table public.purchase
  drop constraint if exists purchase_method_check;
alter table public.purchase
  add constraint purchase_method_check
  check (method in ('stripe','invoice','free'));

insert into public.purchase (
  workspace_id, app_id, person_id, payer_name, payer_email,
  item_label, item_ref, organiser_user_id, team_id,
  amount_cents, currency, method, status, paid_at, created_at
)
select
  te.workspace_id,
  a.id,
  te.person_id,
  coalesce(nullif(trim(concat(p.first_name, ' ', p.last_name)), ''), p.email, ''),
  p.email,
  concat(pr.title,
         case when tk.name is not null then ' · ' || tk.name else '' end,
         ' · ', cp.code),
  te.id::text,
  torg.user_id,
  tt.team_id,
  0,
  coalesce(tk.price_currency, tt.price_currency, 'EUR'),
  'free',
  'paid',
  te.created_at,
  te.created_at
from public.thread_enrolment te
join public.thread_thread tt   on tt.id = te.thread_id
join public.program pr         on pr.id = tt.program_id
join public.thread_organiser torg on torg.id = tt.organiser_id
join public.thread_coupon cp   on cp.id = te.coupon_id
left join public.person p      on p.id = te.person_id
join public.app a              on a.slug = 'the-thread'
left join public.thread_ticket tk on tk.id = te.ticket_id
where te.payment_status = 'not_required'
  and te.coupon_id is not null
on conflict (app_id, item_ref) do nothing;
