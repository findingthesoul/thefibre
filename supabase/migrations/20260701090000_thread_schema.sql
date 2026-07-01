-- The Thread — core schema (rebuild of thethread-v3, Fibre-native)
-- See docs/thread-rebuild-plan.md for the design decisions.
--
-- A thread IS a platform program row (format event|journey, app_id the-thread);
-- an enrolment IS a platform enrolment row. These tables carry only what
-- The Thread justifies: engagements, pricing, coupons, certificates,
-- message sends, payouts.

-- ---------------------------------------------------------------------------
-- thread_organiser — one row per user who organises threads (mirrors meet_host)
-- ---------------------------------------------------------------------------
create table public.thread_organiser (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public."user"(id) on delete cascade,
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  slug                text not null,
  display_name        text,
  bio                 text,
  photo_url           text,
  timezone            text not null default 'Europe/Amsterdam',
  -- Stripe Connect account for this organiser (paste flow, like meet_host)
  stripe_account_id   text,
  -- Share of net revenue (after platform skim) this organiser keeps.
  -- 100 = solo organiser keeps everything; workspace admin lowers it when
  -- the workspace takes a cut. Remainder goes to thread_settings.stripe_account_id.
  vendor_cut_percent  numeric(5,2) not null default 100.00
                        check (vendor_cut_percent between 0 and 100),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index thread_organiser_workspace_idx on public.thread_organiser (workspace_id);

-- ---------------------------------------------------------------------------
-- thread_settings — one row per workspace (org-level Stripe + email branding)
-- ---------------------------------------------------------------------------
create table public.thread_settings (
  workspace_id                uuid primary key references public.workspace(id) on delete cascade,
  stripe_account_id           text,          -- workspace/org connected account (org share destination)
  default_vendor_cut_percent  numeric(5,2) not null default 100.00
                                check (default_vendor_cut_percent between 0 and 100),
  email_from_name             text,
  email_footer_note           text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- thread_certificate_template — element-based designer document
-- elements: [{ type: text|field|image|line, x, y, width (% of page),
--              fontSize, fontFamily, fontWeight, fontStyle, color,
--              textAlign, opacity, value|field|url }]
-- ---------------------------------------------------------------------------
create table public.thread_certificate_template (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  name            text not null,
  page_size       text not null default 'a4' check (page_size in ('a4','letter')),
  orientation     text not null default 'landscape' check (orientation in ('portrait','landscape')),
  background_url  text,
  elements        jsonb not null default '[]'::jsonb,
  created_by      uuid references public."user"(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index thread_certificate_template_workspace_idx
  on public.thread_certificate_template (workspace_id);

-- ---------------------------------------------------------------------------
-- thread_thread — the thread itself. Title, status, dates live on the paired
-- platform program row (1:1); this table carries the app-owned rest.
-- ---------------------------------------------------------------------------
create table public.thread_thread (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspace(id) on delete cascade,
  program_id               uuid not null unique references public.program(id) on delete cascade,
  organiser_id             uuid not null references public.thread_organiser(id),  -- primary / vendor
  slug                     text not null,
  intention                text,                          -- v3: the thread's "why"
  timezone                 text not null default 'Europe/Amsterdam',
  cover_url                text,
  is_public_listed         boolean not null default true,
  requires_approval        boolean not null default false,
  price_cents              integer check (price_cents is null or price_cents >= 0),
  price_currency           char(3),
  capacity                 integer check (capacity is null or capacity > 0),
  registration_fields      jsonb not null default '[]'::jsonb,  -- [{key,label,type,required,options?}]
  certificate_enabled      boolean not null default false,
  certificate_criteria     text,
  certificate_template_id  uuid references public.thread_certificate_template(id) on delete set null,
  created_by               uuid references public."user"(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (organiser_id, slug)                              -- public URL /{organiser}/{thread}
);
create index thread_thread_workspace_idx on public.thread_thread (workspace_id);
create index thread_thread_organiser_idx on public.thread_thread (organiser_id);

-- ---------------------------------------------------------------------------
-- thread_thread_organiser — co-organisers beyond the primary
-- ---------------------------------------------------------------------------
create table public.thread_thread_organiser (
  thread_id     uuid not null references public.thread_thread(id) on delete cascade,
  organiser_id  uuid not null references public.thread_organiser(id) on delete cascade,
  role          text not null default 'co_organiser'
                  check (role in ('co_organiser','facilitator')),
  created_at    timestamptz not null default now(),
  primary key (thread_id, organiser_id)
);
create index thread_thread_organiser_organiser_idx
  on public.thread_thread_organiser (organiser_id);

-- ---------------------------------------------------------------------------
-- thread_engagement — typed items inside a thread. Two families:
--   activities (timed, on the agenda): event | conversation | workshop
--   messages  (scheduled sends):       reflection | practice | message |
--                                      document | inspiration
-- Type may only change within its family after creation (enforced in API).
-- ---------------------------------------------------------------------------
create table public.thread_engagement (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  thread_id       uuid not null references public.thread_thread(id) on delete cascade,
  title           text not null,
  description     text,
  type            text not null check (type in
                    ('event','conversation','workshop',
                     'reflection','practice','message','document','inspiration')),
  status          text not null default 'draft'
                    check (status in ('draft','published','closed')),
  -- activities
  starts_at       timestamptz,
  ends_at         timestamptz,
  location        text,
  meeting_url     text,                                   -- Zoom / Teams / Meet — plain URL
  -- messages
  scheduled_at    timestamptz,                            -- when to send to participants
  content         jsonb not null default '{}'::jsonb,     -- questions / assignments / body / file_url / external_url
  position        integer not null default 0,
  show_in_agenda  boolean not null default true,
  created_by      uuid references public."user"(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint thread_engagement_window_chk
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index thread_engagement_thread_idx
  on public.thread_engagement (thread_id, position);
create index thread_engagement_due_idx
  on public.thread_engagement (scheduled_at)
  where status = 'published' and scheduled_at is not null;

-- ---------------------------------------------------------------------------
-- thread_coupon — discount codes. Discount is applied when the Checkout
-- Session is created (final price computed server-side); no Stripe coupon sync.
-- ---------------------------------------------------------------------------
create table public.thread_coupon (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspace(id) on delete cascade,
  thread_id             uuid not null references public.thread_thread(id) on delete cascade,
  code                  text not null,
  name                  text,
  type                  text not null check (type in ('percentage','amount','free')),
  discount_percentage   numeric(5,2) check (discount_percentage is null or discount_percentage between 0 and 100),
  discount_amount_cents integer check (discount_amount_cents is null or discount_amount_cents >= 0),
  usage_limit           integer check (usage_limit is null or usage_limit > 0),
  used_count            integer not null default 0,
  expires_at            timestamptz,
  is_early_bird         boolean not null default false,
  early_bird_deadline   timestamptz,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (thread_id, code)
);
create index thread_coupon_thread_idx on public.thread_coupon (thread_id);

-- ---------------------------------------------------------------------------
-- thread_enrolment — companion to the platform enrolment row (1:1).
-- Platform owns status + progress; this owns payment + registration answers.
-- ---------------------------------------------------------------------------
create table public.thread_enrolment (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspace(id) on delete cascade,
  thread_id              uuid not null references public.thread_thread(id) on delete cascade,
  enrolment_id           uuid not null unique references public.enrolment(id) on delete cascade,
  person_id              uuid not null references public.person(id),
  payment_status         text not null default 'not_required'
                           check (payment_status in ('not_required','pending','paid','refunded','failed')),
  amount_cents           integer,                          -- final amount after coupon
  currency               char(3),
  coupon_id              uuid references public.thread_coupon(id) on delete set null,
  stripe_session_id      text,
  stripe_payment_intent  text,
  answers                jsonb,                            -- registration_fields responses — never crosses the wall
  request_id             text not null unique,             -- idempotency key from the public form
  created_at             timestamptz not null default now()
);
create index thread_enrolment_thread_idx on public.thread_enrolment (thread_id);
create index thread_enrolment_person_idx on public.thread_enrolment (person_id);

-- ---------------------------------------------------------------------------
-- thread_certificate — issued certificates. Snapshots the template so issued
-- certificates never change when the template is edited later.
-- ---------------------------------------------------------------------------
create table public.thread_certificate (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  thread_id           uuid not null references public.thread_thread(id) on delete cascade,
  thread_enrolment_id uuid not null references public.thread_enrolment(id) on delete cascade,
  certificate_number  text not null unique,                -- THR-YYYY-XXXXX
  recipient_name      text not null,
  recipient_email     citext,
  template_snapshot   jsonb not null,                      -- full template doc at issue time
  issued_by           uuid references public."user"(id),
  issued_at           timestamptz not null default now(),
  unique (thread_enrolment_id)                             -- one certificate per enrolment
);
create index thread_certificate_thread_idx on public.thread_certificate (thread_id);

-- ---------------------------------------------------------------------------
-- thread_message_send — send log for scheduled messages (dedup + idempotency)
-- ---------------------------------------------------------------------------
create table public.thread_message_send (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.thread_engagement(id) on delete cascade,
  person_id      uuid not null references public.person(id) on delete cascade,
  email          citext not null,
  sent_at        timestamptz not null default now(),
  unique (engagement_id, person_id)
);

-- ---------------------------------------------------------------------------
-- thread_payout — revenue-split record per paid enrolment
--   gross = skim (platform, plan-aware) + vendor share + org share
-- ---------------------------------------------------------------------------
create table public.thread_payout (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  thread_id           uuid not null references public.thread_thread(id) on delete cascade,
  thread_enrolment_id uuid not null unique references public.thread_enrolment(id) on delete cascade,
  gross_cents         integer not null,
  platform_fee_cents  integer not null default 0,
  vendor_share_cents  integer not null default 0,
  org_share_cents     integer not null default 0,
  currency            char(3) not null,
  stripe_transfer_id  text,                                -- org-share transfer, when applicable
  status              text not null default 'pending'
                        check (status in ('pending','transferred','failed','not_applicable')),
  created_at          timestamptz not null default now()
);
create index thread_payout_thread_idx on public.thread_payout (thread_id);

-- ---------------------------------------------------------------------------
-- RLS — standard Meet pattern: workspace scope + the-thread app membership.
-- Public pages and webhooks go through the API's service-role client.
-- ---------------------------------------------------------------------------
alter table public.thread_organiser            enable row level security;
alter table public.thread_settings             enable row level security;
alter table public.thread_certificate_template enable row level security;
alter table public.thread_thread               enable row level security;
alter table public.thread_thread_organiser     enable row level security;
alter table public.thread_engagement           enable row level security;
alter table public.thread_coupon               enable row level security;
alter table public.thread_enrolment            enable row level security;
alter table public.thread_certificate          enable row level security;
alter table public.thread_message_send         enable row level security;
alter table public.thread_payout               enable row level security;

create policy thread_organiser_scope on public.thread_organiser
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create policy thread_settings_scope on public.thread_settings
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create policy thread_certificate_template_scope on public.thread_certificate_template
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create policy thread_thread_scope on public.thread_thread
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

-- Join table has no workspace_id; scope through the parent thread.
create policy thread_thread_organiser_scope on public.thread_thread_organiser
  for all to authenticated
  using (exists (select 1 from public.thread_thread t
                  where t.id = thread_id
                    and t.workspace_id = public.current_workspace_id())
         and public.has_app_membership('the-thread'))
  with check (exists (select 1 from public.thread_thread t
                       where t.id = thread_id
                         and t.workspace_id = public.current_workspace_id())
              and public.has_app_membership('the-thread'));

create policy thread_engagement_scope on public.thread_engagement
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create policy thread_coupon_scope on public.thread_coupon
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create policy thread_enrolment_scope on public.thread_enrolment
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create policy thread_certificate_scope on public.thread_certificate
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

-- Send log has no workspace_id; scope through the engagement's thread.
create policy thread_message_send_scope on public.thread_message_send
  for all to authenticated
  using (exists (select 1 from public.thread_engagement e
                  where e.id = engagement_id
                    and e.workspace_id = public.current_workspace_id())
         and public.has_app_membership('the-thread'))
  with check (exists (select 1 from public.thread_engagement e
                       where e.id = engagement_id
                         and e.workspace_id = public.current_workspace_id())
              and public.has_app_membership('the-thread'));

create policy thread_payout_scope on public.thread_payout
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));
