-- v3-style multi-ticket pricing (Sjoerd 2026-07-02): a thread offers a LIST
-- of prices (ticket types), each editable in a popup; discount codes follow
-- the same list+popup pattern (thread_coupon already exists).
create table public.thread_ticket (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspace(id) on delete cascade,
  thread_id        uuid not null references public.thread_thread(id) on delete cascade,
  name             text not null,
  description      text,
  price_cents      integer not null default 0 check (price_cents >= 0),
  price_currency   char(3) not null default 'EUR',
  quantity_limit   integer check (quantity_limit is null or quantity_limit > 0),
  available_until  timestamptz,
  is_active        boolean not null default true,
  position         integer not null default 0,
  created_at       timestamptz not null default now()
);
create index thread_ticket_thread_idx on public.thread_ticket (thread_id, position);

alter table public.thread_enrolment
  add column ticket_id uuid references public.thread_ticket(id) on delete set null;

alter table public.thread_ticket enable row level security;
create policy thread_ticket_scope on public.thread_ticket
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));
