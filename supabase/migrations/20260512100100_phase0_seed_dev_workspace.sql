-- Seed: dev workspace. Production should set this up via admin tooling.
insert into public.workspace (slug, name, plan)
values ('default', 'Default Workspace', 'starter')
on conflict (slug) do nothing;
