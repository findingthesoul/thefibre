// Google Workspace access sync — drains the membership_member_access
// journal for 'google_user' grants (the Circle worker's sibling; see
// circle.ts for the journal contract).
//
// What it does — and deliberately all it does: SUSPEND a member's existing
// Google Workspace account on revoke, UNSUSPEND on grant. It never creates
// accounts (provisioning is a people decision) and never deletes them
// (suspension is reversible; deletion destroys mail and files). A person
// without a Google account in the domain lands in `error` with a message
// the Access page shows.
//
// Auth: service account with domain-wide delegation. We mint the JWT
// ourselves (node:crypto RS256 — no SDK dependency) impersonating the
// workspace's admin (`google_admin_email`), scope admin.directory.user.
// Credential lives per-workspace in membership_settings (service-role
// only). No credential → rows stay pending, silently — the same posture
// as Circle without a token.

import { createSign } from 'node:crypto';
import { adminClient } from '../db.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DIRECTORY_BASE = 'https://admin.googleapis.com/admin/directory/v1';
const SCOPE = 'https://www.googleapis.com/auth/admin.directory.user';

type JournalRow = {
  id: string;
  status: string;
  member_id: string;
  grant: { id: string; kind: string; config: Record<string, unknown> | null } | null;
  member: { id: string; workspace_id: string; person_id: string } | null;
};

// Access tokens are good for an hour; cache per workspace for 50 minutes so
// a 200-row batch doesn't mint 200 JWTs. Keyed by workspace, invalidated by
// time only — a credential change takes effect within the window.
const tokenCache = new Map<string, { token: string; expires: number }>();

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

async function googleAccessToken(
  saJson: string,
  adminEmail: string,
  workspaceId: string,
): Promise<{ token: string } | { error: string }> {
  const cached = tokenCache.get(workspaceId);
  if (cached && cached.expires > Date.now()) return { token: cached.token };

  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(saJson);
  } catch {
    return { error: 'service-account JSON does not parse — re-paste the key file' };
  }
  if (!sa.client_email || !sa.private_key) {
    return { error: 'service-account JSON is missing client_email or private_key' };
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: adminEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  let signature: string;
  try {
    signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key, 'base64url');
  } catch (e) {
    return { error: `private key rejected: ${e instanceof Error ? e.message : String(e)}` };
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claims}.${signature}`,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
    if (!res.ok || !body.access_token) {
      return { error: `token exchange failed: ${body.error_description ?? body.error ?? res.status}` };
    }
    tokenCache.set(workspaceId, { token: body.access_token, expires: Date.now() + 50 * 60 * 1000 });
    return { token: body.access_token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function setSuspended(
  accessToken: string,
  userEmail: string,
  suspended: boolean,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${DIRECTORY_BASE}/users/${encodeURIComponent(userEmail)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended }),
    });
    if (res.ok) return { ok: true, detail: '' };
    if (res.status === 404) {
      return { ok: false, detail: `no Google Workspace account for ${userEmail}` };
    }
    const body = await res.text().catch(() => '');
    return { ok: false, detail: `${res.status} ${body.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function runGoogleUserSync(): Promise<{ granted: number; revoked: number; errors: number }> {
  const out = { granted: 0, revoked: 0, errors: 0 };

  const { data } = await adminClient
    .from('membership_member_access')
    .select(
      'id, status, member_id, grant:access_grant_id (id, kind, config), member:member_id (id, workspace_id, person_id)',
    )
    .in('status', ['pending', 'revoke_pending'])
    .limit(200);
  const rows = (data ?? []) as unknown as JournalRow[];
  const googleRows = rows.filter((r) => r.grant?.kind === 'google_user' && r.member);
  if (!googleRows.length) return out;

  const workspaceIds = [...new Set(googleRows.map((r) => r.member!.workspace_id))];
  const personIds = [...new Set(googleRows.map((r) => r.member!.person_id))];
  const [{ data: settings }, { data: persons }] = await Promise.all([
    adminClient
      .from('membership_settings')
      .select('workspace_id, google_sa_json, google_admin_email')
      .in('workspace_id', workspaceIds),
    adminClient.from('person').select('id, email').in('id', personIds),
  ]);
  const credByWorkspace = new Map(
    (settings ?? []).map((s) => [s.workspace_id, { sa: s.google_sa_json, admin: s.google_admin_email }]),
  );
  const personById = new Map((persons ?? []).map((p) => [p.id, p]));

  for (const row of googleRows) {
    const cred = credByWorkspace.get(row.member!.workspace_id);
    if (!cred?.sa || !cred.admin) continue; // stays pending until the workspace connects Google

    const person = personById.get(row.member!.person_id);
    if (!person?.email) {
      await stamp(row.id, 'error', 'person has no email');
      out.errors += 1;
      continue;
    }

    const auth = await googleAccessToken(cred.sa, cred.admin, row.member!.workspace_id);
    if ('error' in auth) {
      await stamp(row.id, 'error', `Google credential: ${auth.error}`);
      out.errors += 1;
      continue;
    }

    // grant = the account is ACTIVE (unsuspend); revoke = SUSPEND. Both are
    // idempotent PUTs — re-running converges.
    const wantSuspended = row.status !== 'pending';
    const result = await setSuspended(auth.token, person.email, wantSuspended);

    if (result.ok) {
      const next = row.status === 'pending' ? 'granted' : 'revoked';
      await adminClient
        .from('membership_member_access')
        .update({
          status: next,
          external_ref: person.email,
          last_error: null,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (next === 'granted') out.granted += 1;
      else out.revoked += 1;
    } else {
      await stamp(row.id, 'error', result.detail);
      out.errors += 1;
    }
  }

  return out;
}

async function stamp(id: string, status: string, error: string): Promise<void> {
  await adminClient
    .from('membership_member_access')
    .update({ status, last_error: error, updated_at: new Date().toISOString() })
    .eq('id', id);
}
