// Platform super admin — `public."user".is_super_admin`, the person who runs
// the platform itself. NOT the workspace_role of the same name.
//
// Checked against the database on every call rather than trusted from a JWT
// claim: revoking a super admin must take effect on the next request, not at
// the next token refresh.

import { adminClient } from '../db.js';
import type { RequestContext } from '../middleware/app-context.js';

export async function isSuperAdminUser(ctx: RequestContext): Promise<boolean> {
  // An app key has no user, so it can never be a super admin.
  if (ctx.auth !== 'user' || !ctx.userId) return false;
  const { data } = await adminClient
    .from('user')
    .select('is_super_admin')
    .eq('id', ctx.userId)
    .maybeSingle();
  return data?.is_super_admin === true;
}
