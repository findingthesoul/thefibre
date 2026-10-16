-- EMERGENCY: drop the role_change logging triggers (20261016111516).
--
-- The read-back on staging found that hard-deleting a user fails:
--   insert or update on table "role_change" violates foreign key constraint
--   "role_change_subject_user_id_fkey"
-- The user's cascade into workspace_member / app_membership fired the
-- logging triggers, and the depth check meant to skip a cascade did not —
-- so they wrote a row pointing at the user being deleted. Every user
-- hard-delete, and so every throwaway workspace's cleanup, failed with it.
--
-- Dropping the triggers puts every member write back exactly as it was
-- before 20261016111516. The table, its rows and the RPCs stay (nothing calls
-- the RPCs yet); a corrected trigger design comes in its own migration.

drop trigger if exists role_change_workspace_member on public.workspace_member;
drop trigger if exists role_change_app_membership on public.app_membership;
drop trigger if exists role_change_super_admin on public."user";
