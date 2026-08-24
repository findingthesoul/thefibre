-- ---------------------------------------------------------------------------
-- Super admins cannot be deleted, and the platform cannot reach zero of them.
--
-- WHY THIS IS A TRIGGER AND NOT APP CODE
-- `public.user` is written from several directions: the API on a user's JWT,
-- the API on the service role, the erasure flow, one-off scripts, and the
-- Supabase SQL editor. RLS does not apply to the service role and app code
-- cannot see the SQL editor at all. A trigger is the only place a guarantee
-- like this actually holds.
--
-- WHY IT GUARDS THE ROLE, NOT TWO EMAIL ADDRESSES
-- The obvious version of "sjoerd@soul.com and sjoerdluteyn@gmail.com must
-- never be deleted" is a pair of literals in a WHERE clause. That rots the
-- first time someone changes address or a third admin is added, and it says
-- nothing about *why* those two rows are special. The real rule is: you must
-- not be able to lock yourself out of your own platform. Guarding
-- `is_super_admin` says that, covers both accounts today, and covers whoever
-- holds the flag next.
--
-- It is an interlock, not immortality. To remove a super admin you revoke the
-- flag first and then delete — two deliberate steps, in that order, and never
-- one that leaves nobody able to administer the platform.
--
-- WHAT THIS CANNOT PROTECT
-- Deleting the corresponding row in `auth.users` (Supabase dashboard → Auth →
-- Users) breaks sign-in even though `public.user` survives. That table belongs
-- to supabase_auth_admin; adding triggers to it risks breaking Supabase's own
-- operations, so it is deliberately left alone. Treat the Auth users list as
-- the sharp edge it is.
-- ---------------------------------------------------------------------------

create or replace function public.protect_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_others integer;
begin
  -- --- hard delete ---------------------------------------------------------
  if tg_op = 'DELETE' then
    if old.is_super_admin then
      raise exception
        'cannot delete % — they are a platform super admin. Revoke is_super_admin first.',
        old.email
        using errcode = 'raise_exception';
    end if;
    return old;
  end if;

  -- --- soft delete ---------------------------------------------------------
  -- Blocked only while the row still carries the flag on the way out. Setting
  -- deleted_at AND is_super_admin = false in one statement is allowed: that is
  -- someone saying both things on purpose.
  if new.deleted_at is not null
     and old.deleted_at is null
     and coalesce(new.is_super_admin, false) then
    raise exception
      'cannot soft-delete % — they are a platform super admin. Revoke is_super_admin first.',
      old.email
      using errcode = 'raise_exception';
  end if;

  -- --- the last one out ----------------------------------------------------
  -- Without this the guard above is bypassable in two innocent steps: revoke
  -- from both, then delete both. The platform would still have users and no
  -- way to approve anyone onto it, with no UI anywhere to put it right.
  if old.is_super_admin and not coalesce(new.is_super_admin, false) then
    select count(*) into v_others
      from public."user"
     where is_super_admin
       and deleted_at is null
       and id <> old.id;
    if v_others = 0 then
      raise exception
        'refusing: % is the last platform super admin. Grant another one first.',
        old.email
        using errcode = 'raise_exception';
    end if;
  end if;

  -- Same reasoning for soft-deleting the last one where the flag stays set;
  -- covered by the soft-delete branch above, which fires first.
  return new;
end;
$$;

drop trigger if exists user_protect_super_admin_upd on public."user";
create trigger user_protect_super_admin_upd
  before update on public."user"
  for each row execute function public.protect_super_admin();

drop trigger if exists user_protect_super_admin_del on public."user";
create trigger user_protect_super_admin_del
  before delete on public."user"
  for each row execute function public.protect_super_admin();

comment on function public.protect_super_admin() is
  'Interlock, not immortality: a super admin cannot be deleted or soft-deleted while they hold the flag, and the flag cannot be removed from the last one. Revoke first, then delete. Does not and cannot cover auth.users.';
