-- Discount codes that belong to a WORKSPACE, not to one thread.
--
-- Sjoerd, on the membership join panel: "for the discount code... we have our
-- own payment system", and "nothing of Stripe is the rule, except payment" —
-- so a code is ours, its rules are ours, and Stripe is handed a final amount.
-- Codes already work in The Thread (`thread_coupon`, since 20260701090000),
-- and the instruction was to lift what works rather than invent a second
-- system. What could not be lifted is the KEY: thread_coupon is
-- `unique (thread_id, code)` and its validator takes a thread id, so there is
-- no shape of it that a membership tier can use.
--
-- So: the same columns, keyed on the workspace, plus one pair saying what the
-- code applies to.
--
-- WHY ONE POLYMORPHIC ID AND NOT FOUR NULLABLE FKS. Four columns
-- (thread_id, ticket_id, tier_id, product_id) can disagree — two set at once
-- is a state nothing in the UI can express and every reader has to handle.
-- One `applies_to` + one `applies_to_id` cannot. The price is that the
-- database cannot enforce the reference, so the VALIDATOR must prove the
-- target belongs to the same workspace before applying a code (lib/
-- discount-codes.ts). That check is not optional and it is not an
-- optimisation: a code from workspace A naming a thread in workspace B is the
-- exact shape of both cross-workspace holes found in September 2026, and
-- there is a test for it.
--
-- EXISTING thread_coupon ROWS ARE NOT TOUCHED. Nothing is copied, nothing is
-- backfilled, no dual write. The validator asks thread_coupon first and this
-- table second, so every code that works today keeps working unchanged, and a
-- thread's own code wins if the same text exists in both. If those rows are
-- ever to be moved, that is a script per database and a decision of its own.

create table public.discount_code (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspace(id) on delete cascade,
  code                  text not null,
  -- MATCHED ON THIS, never on `code` with a pattern operator. Codes are
  -- compared case-insensitively on purpose — somebody typing `earlybird`
  -- should get `EARLYBIRD` — and the obvious way to do that through PostgREST
  -- is `.ilike()`, which is how the thread path did it and how a visitor
  -- typing `%` or `*` got a discount they had not earned (same day, see
  -- lib/like-escape.ts). A stored lowercased column removes the question
  -- instead of relying on every future caller remembering to escape: the
  -- validator does a plain `.eq()`, which has no pattern semantics at all.
  code_lower            text generated always as (lower(code)) stored,
  name                  text,
  type                  text not null check (type in ('percentage','amount','free')),
  discount_percentage   numeric(5,2) check (discount_percentage is null or discount_percentage between 0 and 100),
  discount_amount_cents integer check (discount_amount_cents is null or discount_amount_cents >= 0),
  usage_limit           integer check (usage_limit is null or usage_limit > 0),
  used_count            integer not null default 0 check (used_count >= 0),
  expires_at            timestamptz,
  is_early_bird         boolean not null default false,
  early_bird_deadline   timestamptz,
  is_active             boolean not null default true,

  -- WHAT IT APPLIES TO. 'workspace' is everything this community sells;
  -- the others name one thing by id.
  applies_to            text not null default 'workspace'
                          check (applies_to in ('workspace','thread','ticket','tier','product')),
  applies_to_id         uuid,

  created_at            timestamptz not null default now(),
  created_by            uuid references public."user"(id) on delete set null,

  -- The two halves of the scope cannot contradict each other: a code that
  -- applies to the whole workspace names nothing, and a code that names
  -- something is not workspace-wide. Without this, `applies_to = 'tier'` with
  -- a null id reads as "every tier" in one branch and "no tier" in another.
  constraint discount_code_scope_shape check (
    (applies_to = 'workspace' and applies_to_id is null)
    or (applies_to <> 'workspace' and applies_to_id is not null)
  ),

  -- A code's TYPE must come with the number that type needs. Without this,
  -- `type = 'percentage'` with a null percentage is a valid row, and every
  -- reader has to invent a meaning for it — which is how one place decides
  -- "no discount" and another "100% off". 'free' needs neither number.
  constraint discount_code_amount_shape check (
    (type = 'percentage' and discount_percentage is not null)
    or (type = 'amount' and discount_amount_cents is not null)
    or type = 'free'
  )
);

-- ONE CODE PER COMMUNITY, case-insensitively. The existing key is per THREAD,
-- so "SUMMER25" can mean two different things on two threads of one
-- community; at workspace level that would be a trap rather than a feature.
create unique index discount_code_workspace_code_idx
  on public.discount_code (workspace_id, code_lower);

create index discount_code_workspace_idx on public.discount_code (workspace_id);
create index discount_code_target_idx on public.discount_code (applies_to, applies_to_id)
  where applies_to_id is not null;

alter table public.discount_code enable row level security;

-- READS are for the workspace; the public validator runs on the service role,
-- as the thread one does, because somebody typing a code on a join page is
-- not signed in to anything.
--
-- No `has_app_membership` here, deliberately: thread_coupon's policy carries
-- `has_app_membership('the-thread')` because it is Thread's data. A platform
-- code is not any one app's, and gating it on an app membership would mean a
-- community that runs Members but not Thread could not read its own codes.
create policy discount_code_read on public.discount_code
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

-- WRITES follow the same role gate as the rest of a workspace's money
-- settings: an admin, not everybody who can see the page. (thread_coupon
-- predates workspace_role and gates on app membership alone; this does not
-- copy that.)
create policy discount_code_write on public.discount_code
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.current_workspace_role() in ('super_admin','admin')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.current_workspace_role() in ('super_admin','admin')
  );

comment on table public.discount_code is
  'Workspace-wide discount codes (2026-10-13). The per-thread thread_coupon table is unchanged and is still checked FIRST by the validator, so a thread''s own code wins over a workspace code of the same text. applies_to_id has no FK by design — the validator must prove the target is in the same workspace before applying the code.';

comment on column public.discount_code.applies_to_id is
  'The thread, ticket, tier or product this code is limited to. NO foreign key: one nullable id cannot contradict itself the way four nullable FK columns can. The cost is that tenancy is the validator''s job — see lib/discount-codes.ts and its cross-workspace test.';

-- ATOMIC REDEMPTION. The thread path does this as a read-then-write
-- (`used_count: coupon.used_count + 1` in routes/thread.ts, from a value read
-- earlier), so two people redeeming the last use of a code at the same moment
-- both read the old number and both get in. That is a real bug in the old
-- path and is left alone here rather than fixed in passing — but the new
-- table does not inherit it.
--
-- The update is the check: it only matches while the code still has a use
-- left, and it returns the new count. Zero rows back means "no use left",
-- which is the honest answer to a race rather than a second query that can
-- be overtaken between the two.
create or replace function public.redeem_discount_code(p_code_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.discount_code
     set used_count = used_count + 1
   where id = p_code_id
     and is_active
     and (expires_at is null or expires_at > now())
     and (usage_limit is null or used_count < usage_limit)
  returning used_count;
$$;

-- Definer functions are born closed in this codebase (2026-09-14): PUBLIC
-- gets nothing, and the one caller is granted explicitly. Redemption happens
-- on the service role, from the public join and enrol paths, where the person
-- redeeming is not signed in to the workspace at all.
revoke all on function public.redeem_discount_code(uuid) from public;
revoke all on function public.redeem_discount_code(uuid) from anon, authenticated;
-- And the one caller, named. Supabase's defaults usually cover service_role
-- already; a function described as "born closed" should not rest on a default
-- that a project setting can change.
grant execute on function public.redeem_discount_code(uuid) to service_role;

comment on function public.redeem_discount_code(uuid) is
  'Takes one use of a code, atomically. Returns the new used_count, or NO ROW when the code is inactive, expired or fully used — the update itself is the check, so two simultaneous redemptions of the last use cannot both succeed. It encodes the expiry as well as the limit on purpose: the validator checks both earlier, and an RPC that enforced only half of the rules would invite a second caller that skipped the validator.';
