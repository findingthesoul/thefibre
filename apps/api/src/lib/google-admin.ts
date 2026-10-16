// Google Workspace access sync — drains the membership_member_access
// journal for 'google_user' grants (the Circle worker's sibling; see
// circle.ts for the journal contract).
//
// What it does — and deliberately all it does: SUSPEND a member's existing
// Google Workspace account on revoke, UNSUSPEND on grant, and READ one user
// to see whether an address is taken (for the suggested address). It never
// creates accounts (provisioning is a people decision: an admin makes the
// account by hand and marks it created — Sjoerd, 2026-10-16) and never
// deletes them (suspension is reversible; deletion destroys mail and files).
// google-admin.test.ts asserts the only calls are that GET and that PUT.
//
// WHICH ADDRESS (2026-10-16). The account a member's access follows is, in
// order: the address an admin marked created (membership_google_account);
// else their person email when it is IN the workspace's Google domain (the
// case that already worked); else none yet — the row stays pending, saying
// it waits for the account, instead of an error on an address (x@gmail.com)
// that could never exist in the domain.
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

/** The workspace's Google domain: the part after @ of its delegation admin. */
export function googleDomainOf(adminEmail: string | null | undefined): string | null {
  const d = (adminEmail ?? '').split('@')[1]?.trim().toLowerCase();
  return d ? d : null;
}

export const WAITING_FOR_ACCOUNT = 'waiting for the Google account to be created';

/**
 * The address this member's Google access follows, or null when there is
 * none yet (see the header: created → in-domain person email → none).
 */
export function managedAddress(
  account: { status: string; created_address: string | null } | null | undefined,
  personEmail: string | null | undefined,
  domain: string | null,
): string | null {
  if (account?.status === 'created' && account.created_address) return account.created_address.toLowerCase();
  const email = (personEmail ?? '').trim().toLowerCase();
  if (domain && email.endsWith(`@${domain}`)) return email;
  return null;
}

/** A workspace's Google access token, or why not. */
export async function googleTokenFor(workspaceId: string): Promise<{ token: string; domain: string } | { error: string }> {
  const { data } = await adminClient
    .from('membership_settings')
    .select('google_sa_json, google_admin_email')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  const domain = googleDomainOf(data?.google_admin_email as string | null);
  if (!data?.google_sa_json || !data.google_admin_email || !domain) return { error: 'Google is not connected' };
  const auth = await googleAccessToken(data.google_sa_json as string, data.google_admin_email as string, workspaceId);
  return 'error' in auth ? auth : { token: auth.token, domain };
}

/** READ ONE USER: is this address taken in the domain? A GET — never a write. */
export async function googleUserExists(accessToken: string, address: string): Promise<boolean> {
  const res = await fetch(`${DIRECTORY_BASE}/users/${encodeURIComponent(address)}?fields=primaryEmail`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok) return true;
  if (res.status === 404) return false;
  throw new Error(`Google lookup ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

export async function runGoogleUserSync(
  /** Tests only: one workspace's rows, so a test never touches anybody else's
   *  journal (the same shape as member-notify's runNewThreadPass scope). */
  scope: { workspaceIds?: string[] } = {},
): Promise<{ granted: number; revoked: number; errors: number }> {
  const out = { granted: 0, revoked: 0, errors: 0 };

  let query = adminClient
    .from('membership_member_access')
    .select(
      'id, status, member_id, grant:access_grant_id (id, kind, config), member:member_id (id, workspace_id, person_id)',
    )
    .in('status', ['pending', 'revoke_pending'])
    .limit(200);
  if (scope.workspaceIds) {
    const { data: members } = await adminClient.from('membership_member').select('id').in('workspace_id', scope.workspaceIds);
    const ids = (members ?? []).map((m) => m.id as string);
    if (!ids.length) return out;
    query = query.in('member_id', ids);
  }
  const { data } = await query;
  const rows = (data ?? []) as unknown as JournalRow[];
  const googleRows = rows.filter((r) => r.grant?.kind === 'google_user' && r.member);
  if (!googleRows.length) return out;

  const workspaceIds = [...new Set(googleRows.map((r) => r.member!.workspace_id))];
  const personIds = [...new Set(googleRows.map((r) => r.member!.person_id))];
  const memberIds = [...new Set(googleRows.map((r) => r.member!.id))];
  const [{ data: settings }, { data: persons }, { data: accounts, error: accErr }] = await Promise.all([
    adminClient
      .from('membership_settings')
      .select('workspace_id, google_sa_json, google_admin_email')
      .in('workspace_id', workspaceIds),
    adminClient.from('person').select('id, email').in('id', personIds),
    adminClient.from('membership_google_account').select('member_id, status, created_address').in('member_id', memberIds),
  ]);
  // A failed read must not look like "no account made yet": stop the tick,
  // the next one retries.
  if (accErr) throw new Error(`google accounts: ${accErr.message}`);
  const accountByMember = new Map((accounts ?? []).map((a) => [a.member_id as string, a as { status: string; created_address: string | null }]));
  const credByWorkspace = new Map(
    (settings ?? []).map((s) => [s.workspace_id, { sa: s.google_sa_json, admin: s.google_admin_email }]),
  );
  const personById = new Map((persons ?? []).map((p) => [p.id, p]));

  for (const row of googleRows) {
    const cred = credByWorkspace.get(row.member!.workspace_id);
    if (!cred?.sa || !cred.admin) continue; // stays pending until the workspace connects Google

    const person = personById.get(row.member!.person_id);
    const address = managedAddress(accountByMember.get(row.member!.id), person?.email, googleDomainOf(cred.admin));
    if (!address) {
      if (row.status === 'pending') {
        // Not an error: the account is a person's decision and has not been
        // made yet. Pending, with the reason; "Mark as created" re-queues it.
        await adminClient
          .from('membership_member_access')
          .update({ last_error: WAITING_FOR_ACCOUNT, updated_at: new Date().toISOString() })
          .eq('id', row.id);
      } else {
        // Revoke with no account ever made: nothing to suspend.
        await adminClient
          .from('membership_member_access')
          .update({ status: 'revoked', last_error: null, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', row.id);
        out.revoked += 1;
      }
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
    const result = await setSuspended(auth.token, address, wantSuspended);

    if (result.ok) {
      const next = row.status === 'pending' ? 'granted' : 'revoked';
      await adminClient
        .from('membership_member_access')
        .update({
          status: next,
          external_ref: address,
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
