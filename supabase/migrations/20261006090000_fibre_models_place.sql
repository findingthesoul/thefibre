-- Business Models: where a person was in a model, per person, per model.
--
-- Sjoerd, 2026-10-06: "Please remember the page one was on in the Model
-- (which tab and which view), per user. When logging in and opening a model,
-- it would be great if you get there immediately. Also when you refresh."
-- A refresh already reads the address; this is the half that survives a
-- login on another device: one row per (person, model), read with the model,
-- written on every change of tab or view. Nobody but the person sees it.

create table public.models_place (
  user_id    uuid not null references public."user"(id) on delete cascade,
  model_id   uuid not null references public.models_model(id) on delete cascade,
  tab        text not null default 'canvas' check (tab in ('canvas', 'numbers', 'assumptions')),
  view       text check (view is null or length(view) <= 32),
  updated_at timestamptz not null default now(),
  primary key (user_id, model_id)
);
comment on table public.models_place is
  'Business Models app: the tab and view a person last had open in a model. Private to the person.';

alter table public.models_place enable row level security;

create policy models_place_own on public.models_place
  for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());
