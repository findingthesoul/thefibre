-- Team-member invites become two-step:
--   1. Lead invites email → row created with status='invited' + invite_token
--   2. Invitee signs in and clicks Accept → status flips to 'active', token cleared
--
-- Until step 2 the row is "pending"; the user has no fibre-meet membership
-- and is excluded from rosters used for round-robin / collective.
--
-- Existing rows are status='active' (backfilled by the column default applied
-- after the alter; explicit update is a safety net).

alter table public.meet_team_member
  add column status text not null default 'active'
    check (status in ('active', 'invited')),
  add column invite_token text,
  add column invited_at timestamptz,
  add column accepted_at timestamptz;

update public.meet_team_member set status = 'active' where status is null;

create unique index meet_team_member_invite_token_uq
  on public.meet_team_member (invite_token)
  where invite_token is not null;
