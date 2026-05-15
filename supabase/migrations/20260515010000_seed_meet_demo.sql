-- ============================================================================
-- v0.5.4 — minimal seed so meet.thefibre.app has something to render.
-- Creates a meet_host row for the founding user + two sample meeting types.
-- Idempotent: re-running is safe.
-- ============================================================================

-- Provision a host for sjoerd@soul.com (if a user exists).
insert into public.meet_host (user_id, workspace_id, slug, timezone, bio, working_hours)
select
  u.id,
  u.workspace_id,
  'sjoerd',
  'Europe/Amsterdam',
  'Founder of The Fibre. Facilitator, designer, builder.',
  jsonb_build_object(
    'mon', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '17:00')),
    'tue', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '17:00')),
    'wed', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '17:00')),
    'thu', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '17:00')),
    'fri', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '13:00'))
  )
  from public."user" u
 where u.email = 'sjoerd@soul.com'
   and u.deleted_at is null
on conflict (user_id) do nothing;

-- Two meeting types: a short intro + a longer working session.
insert into public.meet_meeting_type (
  workspace_id, host_id, slug, name, description, duration_minutes,
  conferencing_provider, is_active
)
select
  h.workspace_id,
  h.id,
  v.slug,
  v.name,
  v.description,
  v.duration_minutes,
  v.conferencing_provider,
  true
  from public.meet_host h
  cross join (values
    ('intro',    'Introduction call',
     'A 30-minute introduction. Tell me about what you''re working on and what would help.',
     30, 'google_meet'),
    ('working-session', 'Working session',
     'A focused 60-minute session — co-design, problem-solve, or unblock something concrete.',
     60, 'google_meet')
  ) as v(slug, name, description, duration_minutes, conferencing_provider)
 where h.slug = 'sjoerd'
on conflict (host_id, slug) do nothing;
