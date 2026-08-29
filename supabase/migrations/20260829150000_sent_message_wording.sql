-- Grammar only. 20260829140000 raised "sent to 1 people"; this is the text a
-- person sees in The Thread's editor when they try to change a message that has
-- already gone out, so it should read like a sentence. Behaviour is unchanged.
--
-- A separate migration because Supabase tracks migrations by filename: editing
-- an applied file is a no-op on remote (see CLAUDE.md, Gotchas).

create or replace function public.thread_engagement_frozen_once_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_sent  integer;
  v_who   text;
begin
  if tg_op = 'DELETE' then
    v_id := old.id;
  else
    v_id := new.id;
  end if;

  select count(*) into v_sent
    from public.thread_message_send
   where engagement_id = v_id;

  -- "sent to 1 people" is the kind of sloppiness that reads as unfinished,
  -- and a person in The Thread's editor is who sees this.
  v_who := v_sent || ' person' || case when v_sent = 1 then '' else 's' end;

  if v_sent = 0 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    raise exception
      'this message has already been sent to % and cannot be deleted — deleting it would drop the record of who received it, and re-creating it would send to them again',
      v_who
      using errcode = 'raise_exception';
  end if;

  if new.title       is distinct from old.title
     or new.description is distinct from old.description
     or new.content     is distinct from old.content then
    raise exception
      'this message has already been sent to % and its wording cannot be changed — anyone enrolling later would receive different words under the same title. Write a new message instead.',
      v_who
      using errcode = 'raise_exception';
  end if;

  return new;
end;
$$;

drop trigger if exists thread_engagement_frozen_upd on public.thread_engagement;
create trigger thread_engagement_frozen_upd
  before update on public.thread_engagement
  for each row execute function public.thread_engagement_frozen_once_sent();

drop trigger if exists thread_engagement_frozen_del on public.thread_engagement;
create trigger thread_engagement_frozen_del
  before delete on public.thread_engagement
  for each row execute function public.thread_engagement_frozen_once_sent();

comment on function public.thread_engagement_frozen_once_sent() is
  'Once any thread_message_send row exists for an engagement, its title/description/content are immutable and it cannot be deleted. status, position, show_in_agenda and the trigger columns stay editable so a message can still be stopped or re-timed. Applies to The Thread''s editor and the app surface alike.';
