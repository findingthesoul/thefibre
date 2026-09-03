// Approving a signup — ONE implementation, whether a super admin clicked
// Approve or auto-approval did it at submission (Signup v2, 2026-09-03).
// Creates the workspace, marks the request, switches on the plan's apps,
// sends the welcome email. The user/person rows are still created at first
// sign-in via sso/resolve — nothing personal exists until they arrive.

import { adminClient } from '../db.js';
import { sendEmail } from './email/client.js';
import { renderWorkspaceReadyEmail } from './email/platform-templates.js';
import { ensurePlanApps } from './plan-apps.js';

type SignupRow = {
  id: string;
  email: string;
  full_name: string | null;
  organisation_name: string | null;
  desired_plan: string | null;
};

export async function approveSignup(
  reqRow: SignupRow,
  decidedBy: string | null,
  decisionNotes: string | null = null,
): Promise<{ workspaceId: string } | { error: string }> {
  const slugBase = (reqRow.organisation_name ?? reqRow.email.split('@')[0] ?? 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
  const wsName = reqRow.organisation_name ?? reqRow.full_name ?? reqRow.email;

  const { data: ws, error: wsErr } = await adminClient
    .from('workspace')
    .insert({ slug, name: wsName })
    .select('id')
    .single();
  if (wsErr || !ws) {
    console.error('[signup-approval] workspace create failed', wsErr);
    return { error: wsErr?.message ?? 'workspace create failed' };
  }

  const { error: uErr } = await adminClient
    .from('signup_request')
    .update({
      status: 'approved',
      workspace_id: ws.id,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      decision_notes: decisionNotes,
    })
    .eq('id', reqRow.id);
  if (uErr) {
    console.error('[signup-approval] request update failed', uErr);
    return { error: uErr.message };
  }

  // The plan's apps switch on now (Meet + Thread on Free); memberships fill
  // in at first sign-in when the user row exists (sso/resolve calls
  // ensurePlanApps again — it is idempotent).
  void ensurePlanApps(ws.id);

  // The welcome — fire-and-forget: approval already happened, a mail hiccup
  // must not make it look failed.
  let desiredPlanName: string | null = null;
  if (reqRow.desired_plan && reqRow.desired_plan !== 'free') {
    const { data: plan } = await adminClient
      .from('billing_plan')
      .select('name')
      .eq('id', reqRow.desired_plan)
      .maybeSingle();
    desiredPlanName = plan?.name ?? null;
  }
  const welcome = renderWorkspaceReadyEmail({
    fullName: reqRow.full_name ?? '',
    workspaceName: wsName,
    desiredPlanName,
  });
  void sendEmail({ to: reqRow.email, ...welcome }).catch((e) =>
    console.error('[signup-approval] welcome email failed', e),
  );

  return { workspaceId: ws.id };
}
