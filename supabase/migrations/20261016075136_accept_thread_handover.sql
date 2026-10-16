-- accept_thread_handover
--
-- The one step that hands a thread to its new organiser
-- (docs/organiser-handover-design.md, "Accepting is one transaction").
-- Everything that must change together changes here, or nothing does; the
-- side effects that call out (rooms, calendar notices, mail) run in the API
-- after this commits, and are idempotent.
--
-- BORN CLOSED: revoked from public, anon and authenticated; executable by
-- service_role only. The API decides WHO may accept (the proposed organiser's
-- own session) and passes that user as p_acting_user; this function checks
-- it again against the request, because a definer function that trusts its
-- caller's word is a door with the lock on the outside.
--
-- p_old_account: the Stripe account this thread's past card sales were taken
-- on, as the API resolves it BEFORE the switch (lib/payment-accounts.ts
-- chargeAccountForItem). Rows that do not record their own account are
-- stamped with it, so a refund of a pre-handover sale can never be re-resolved
-- through the NEW organiser. Null = nothing to stamp.
--
-- Returns the facts the API's side effects need.

create or replace function public.accept_thread_handover(
  p_handover_id uuid,
  p_acting_user uuid,
  p_old_account text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h            public.thread_organiser_handover%rowtype;
  t            record;
  from_org     record;
  to_org       record;
  thread_app   uuid;
  stamped      integer := 0;
begin
  select * into h from public.thread_organiser_handover where id = p_handover_id for update;
  if not found then
    raise exception 'handover not found' using errcode = 'P0002';
  end if;
  if h.status <> 'pending' then
    raise exception 'handover is %', h.status using errcode = 'P0001';
  end if;
  -- Refused, not flipped: a RAISE rolls back everything in this call, so an
  -- update before it would never persist. Reads report a pending row past its
  -- expires_at as expired (the design's "checked, not swept").
  if h.expires_at <= now() then
    raise exception 'handover expired' using errcode = 'P0001';
  end if;

  select id, user_id, slug into to_org from public.thread_organiser where id = h.to_organiser_id;
  if to_org.user_id is distinct from p_acting_user then
    raise exception 'only the proposed organiser may accept' using errcode = '42501';
  end if;
  select id, user_id, slug into from_org from public.thread_organiser where id = h.from_organiser_id;

  select id, slug, team_id, public_scope, organiser_id, workspace_id
    into t from public.thread_thread where id = h.thread_id for update;
  if t.organiser_id is distinct from h.from_organiser_id then
    -- Somebody else changed the organiser since the proposal; this request
    -- describes a thread that no longer exists in that shape. Refused (the
    -- API marks it cancelled in its own statement — see the note above on
    -- why it cannot happen here).
    raise exception 'the thread''s organiser changed since this was proposed' using errcode = 'P0001';
  end if;

  -- (1) The old public address, for a thread whose owner IS the organiser:
  -- personal scope, or no scope and no team (lib/public-owner-slug.ts).
  if (t.public_scope = 'personal' or (t.public_scope is null and t.team_id is null))
     and from_org.slug is not null then
    insert into public.thread_owner_history (thread_id, workspace_id, old_owner_slug, thread_slug)
      values (t.id, t.workspace_id, from_org.slug, t.slug)
      on conflict (thread_id, old_owner_slug, thread_slug) do update set changed_at = now();
  end if;

  -- (2) Past card sales keep the account they were taken on.
  if p_old_account is not null then
    select id into thread_app from public.app where slug = 'the-thread';
    update public.purchase p
       set stripe_account_id = p_old_account
     where p.app_id = thread_app
       and p.stripe_account_id is null
       and p.method = 'stripe'
       and p.item_ref in (select te.id::text from public.thread_enrolment te where te.thread_id = t.id);
    get diagnostics stamped = row_count;
  end if;

  -- The switch.
  update public.thread_thread set organiser_id = h.to_organiser_id where id = t.id;

  -- (6) The new organiser is no longer a host of their own thread; the old
  -- one stays as a host unless that was unticked.
  delete from public.thread_thread_organiser
   where thread_id = t.id and organiser_id = h.to_organiser_id;
  if h.keep_as_host then
    insert into public.thread_thread_organiser (thread_id, organiser_id, role)
      values (t.id, h.from_organiser_id, 'host')
      on conflict (thread_id, organiser_id) do nothing;
  end if;

  update public.thread_organiser_handover
     set status = 'accepted', decided_at = now(), decided_by_user_id = p_acting_user
   where id = h.id;

  return jsonb_build_object(
    'thread_id', t.id,
    'workspace_id', t.workspace_id,
    'from_organiser_id', h.from_organiser_id,
    'from_user_id', from_org.user_id,
    'to_organiser_id', h.to_organiser_id,
    'to_user_id', to_org.user_id,
    'old_owner_slug', from_org.slug,
    'new_owner_slug', to_org.slug,
    'keep_as_host', h.keep_as_host,
    'stamped_purchases', stamped
  );
end;
$$;

revoke all on function public.accept_thread_handover(uuid, uuid, text) from public;
revoke all on function public.accept_thread_handover(uuid, uuid, text) from anon, authenticated;
grant execute on function public.accept_thread_handover(uuid, uuid, text) to service_role;
