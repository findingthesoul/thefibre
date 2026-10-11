// Whether to tell somebody that Zoom is still waiting on Zoom.
//
// Sjoerd, 2026-10-12: a comment by the Connect button, for everybody except
// him, saying the Zoom app is still under review and to use Google Meet or a
// personal Zoom room link meanwhile.
//
// The DECISION lives here, server-side, and the three apps that draw a Zoom
// Connect button only render what they are told. That is on purpose: the two
// people who must not see this notice are identified by things an app has no
// business knowing (who is a super admin, and which workspace is the Zoom
// reviewer's), and three copies of that logic would be three chances to get
// it wrong.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ REMOVE WHEN THE ZOOM MARKETPLACE APP IS PUBLISHED.                       ║
// ║                                                                          ║
// ║ Set ZOOM_MARKETPLACE_PENDING to false and the notice is gone everywhere  ║
// ║ — no deploy of the web apps needed, since they follow this flag. Then    ║
// ║ delete this file, packages/shared/src/zoom-pending-i18n.ts, the `notice` ║
// ║ prop on ui/provider-connection.tsx and the three call sites.             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { adminClient } from '../db.js';
import { isSuperAdminUser } from './super-admin.js';
import type { RequestContext } from '../middleware/app-context.js';

/** The switch. See the box above. */
export const ZOOM_MARKETPLACE_PENDING = true;

/**
 * Workspaces that must NOT see the notice, beyond super admins.
 *
 * Stored as `workspace_app.settings.zoom_notice = 'off'` on the workspace's
 * PLATFORM app row — an existing per-workspace jsonb (20260514160000), so
 * this needs no migration and no new table for something that is coming out
 * again.
 *
 * It exists for one reader: the Zoom Marketplace reviewer. He is testing the
 * very integration this notice says is unapproved, and telling him it is
 * still under request — and to use Google instead — would undermine the
 * review he is conducting. His account is NOT named anywhere in this
 * codebase; his workspace carries a flag, and the flag is what is read.
 *
 * FAILS TOWARDS SHOWING THE NOTICE. If this read fails, or the row is absent,
 * the notice shows. That is the right way round for everybody except the
 * reviewer — which is why the flag must be set on production BEFORE this
 * reaches it, not afterwards. An exemption list that is consulted after the
 * fact protects nobody (docs/testing-approach: exemption lists fail open).
 */
async function workspaceOptedOut(workspaceId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from('workspace_app')
    .select('settings, app:app_id(slug)')
    .eq('workspace_id', workspaceId)
    .is('deactivated_at', null);
  if (error) {
    console.error('[zoom-pending] workspace_app read failed', error);
    return false;
  }
  const rows = (data ?? []) as unknown as {
    settings: Record<string, unknown> | null;
    app: { slug: string } | null;
  }[];
  return rows.some(
    (r) => r.app?.slug === 'fibre-platform' && r.settings?.['zoom_notice'] === 'off',
  );
}

/**
 * Should this request's person see the notice?
 *
 * Three ways to answer no: the app is published (the flag), the caller is a
 * super admin (Sjoerd — by role, never by email address), or their workspace
 * has opted out.
 *
 * Never a reason to answer no: being connected already. The caller decides
 * that, because the notice sits beside a Connect button that only exists
 * while disconnected.
 */
export async function showZoomPendingNotice(ctx: RequestContext): Promise<boolean> {
  if (!ZOOM_MARKETPLACE_PENDING) return false;
  if (await isSuperAdminUser(ctx)) return false;
  if (await workspaceOptedOut(ctx.workspaceId)) return false;
  return true;
}
