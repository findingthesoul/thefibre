// Circle.so access sync — drains the membership_member_access journal.
//
// The journal is the contract (proposal §3.6): membership writes pending /
// revoke_pending rows at lifecycle moments; this worker performs them
// against Circle's Admin API and stamps the outcome. Idempotent and
// re-runnable: a row only moves forward (pending → granted | error,
// revoke_pending → revoked | error), and Circle's own endpoints tolerate
// repeats (inviting an existing member is a no-op).
//
// Endpoints are Circle's Admin API v1 (Authorization: Token <token>).
// If a community is on a plan that only speaks Admin v2, CIRCLE_API_BASE
// + these two functions are the whole surface to update.
//
// The token is per-workspace in membership_settings (service-role only).
// No token → rows stay pending, silently; the Access page already shows
// the "add your Circle API token" callout for exactly that state.

import { adminClient } from '../db.js';

const CIRCLE_API_BASE = process.env.CIRCLE_API_BASE ?? 'https://app.circle.so/api/v1';

type JournalRow = {
  id: string;
  status: string;
  member_id: string;
  grant: { id: string; kind: string; config: Record<string, unknown> | null } | null;
  member: { id: string; workspace_id: string; person_id: string } | null;
};

async function circleCall(
  token: string,
  method: 'POST' | 'DELETE',
  path: string,
  params: Record<string, string | string[]>,
): Promise<{ ok: boolean; detail: string }> {
  const url = new URL(`${CIRCLE_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(`${k}[]`, item));
    else url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Token ${token}` },
    });
    const body = await res.text().catch(() => '');
    // Circle answers 200 with {success:false,...} on some errors — treat
    // an explicit success:false as failure so it lands in last_error.
    const softFail = body.includes('"success":false');
    return { ok: res.ok && !softFail, detail: res.ok && !softFail ? '' : `${res.status} ${body.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function runCircleAccessSync(): Promise<{ granted: number; revoked: number; errors: number }> {
  const out = { granted: 0, revoked: 0, errors: 0 };

  const { data } = await adminClient
    .from('membership_member_access')
    .select(
      'id, status, member_id, grant:access_grant_id (id, kind, config), member:member_id (id, workspace_id, person_id)',
    )
    .in('status', ['pending', 'revoke_pending'])
    .limit(200);
  const rows = (data ?? []) as unknown as JournalRow[];
  const circleRows = rows.filter((r) => r.grant?.kind === 'circle' && r.member);
  if (!circleRows.length) return out;

  // One settings + person lookup per batch, not per row.
  const workspaceIds = [...new Set(circleRows.map((r) => r.member!.workspace_id))];
  const personIds = [...new Set(circleRows.map((r) => r.member!.person_id))];
  const [{ data: settings }, { data: persons }] = await Promise.all([
    adminClient
      .from('membership_settings')
      .select('workspace_id, circle_api_token')
      .in('workspace_id', workspaceIds),
    adminClient.from('person').select('id, first_name, last_name, email').in('id', personIds),
  ]);
  const tokenByWorkspace = new Map((settings ?? []).map((s) => [s.workspace_id, s.circle_api_token]));
  const personById = new Map((persons ?? []).map((p) => [p.id, p]));

  for (const row of circleRows) {
    const token = tokenByWorkspace.get(row.member!.workspace_id);
    if (!token) continue; // stays pending until the workspace adds a token

    const person = personById.get(row.member!.person_id);
    if (!person?.email) {
      await adminClient
        .from('membership_member_access')
        .update({ status: 'error', last_error: 'person has no email', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      out.errors += 1;
      continue;
    }

    const spaceId = row.grant?.config?.space_id;
    let result: { ok: boolean; detail: string };
    if (row.status === 'pending') {
      result = await circleCall(token, 'POST', '/community_members', {
        email: person.email,
        name: [person.first_name, person.last_name].filter(Boolean).join(' '),
        ...(typeof spaceId === 'string' && spaceId ? { space_ids: [spaceId] } : {}),
      });
    } else {
      // Tier-scoped revoke removes from the grant's space; a grant without
      // a space removes from the community (the lapse case).
      result =
        typeof spaceId === 'string' && spaceId
          ? await circleCall(token, 'DELETE', '/space_members', { email: person.email, space_id: spaceId })
          : await circleCall(token, 'DELETE', '/community_members', { email: person.email });
    }

    if (result.ok) {
      const next = row.status === 'pending' ? 'granted' : 'revoked';
      await adminClient
        .from('membership_member_access')
        .update({
          status: next,
          external_ref: typeof spaceId === 'string' ? spaceId : null,
          last_error: null,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (next === 'granted') out.granted += 1;
      else out.revoked += 1;
    } else {
      await adminClient
        .from('membership_member_access')
        .update({ status: 'error', last_error: result.detail, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      out.errors += 1;
    }
  }

  return out;
}
