-- Meet profile save 500'd with "new row violates row-level security policy
-- for table meet_root_slug" (Sjoerd, staging, 2026-09-05). The
-- meet_root_slug sync triggers were plain plpgsql, so a USER-session write
-- to meet_host/meet_team ran the registry insert as `authenticated` — and
-- meet_root_slug deliberately has no authenticated write policy. The
-- original migration's "populated via triggers — RLS-safe" was only ever
-- true for service-role writes. SECURITY DEFINER is the missing word: the
-- registry is derived state, synced by the system, never written by users.

create or replace function public.meet_sync_host_root_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.meet_root_slug (workspace_id, slug, kind, host_id)
      values (new.workspace_id, new.slug, 'host', new.id);
  elsif tg_op = 'UPDATE' then
    if new.slug is distinct from old.slug or new.workspace_id is distinct from old.workspace_id then
      delete from public.meet_root_slug where host_id = new.id;
      insert into public.meet_root_slug (workspace_id, slug, kind, host_id)
        values (new.workspace_id, new.slug, 'host', new.id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.meet_sync_team_root_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.meet_root_slug (workspace_id, slug, kind, team_id)
      values (new.workspace_id, new.slug, 'team', new.id);
  elsif tg_op = 'UPDATE' then
    if new.slug is distinct from old.slug or new.workspace_id is distinct from old.workspace_id then
      delete from public.meet_root_slug where team_id = new.id;
      insert into public.meet_root_slug (workspace_id, slug, kind, team_id)
        values (new.workspace_id, new.slug, 'team', new.id);
    end if;
  end if;
  return new;
end;
$$;
