// A member's Google Workspace ADDRESS (Sjoerd, 2026-10-16; coordinator's
// approved plan; B3's review). When a membership includes a Google account the
// member sees a SUGGESTED address and accepts it or asks for another; an admin
// creates the account BY HAND in Google and marks it created; the grant worker
// (lib/google-admin.ts) then manages that address.
//
// The Fibre never creates a Google account. The only Google call here is a
// read — googleUserExists, to keep a suggestion off an address already taken.
//
// One row per membership (membership_google_account, UNIQUE member_id).
// Service role: every query filters workspace_id itself (handbook §2).

import { adminClient } from '../db.js';
import { googleDomainOf, googleTokenFor, googleUserExists } from './google-admin.js';
import { sendEmail } from './email/client.js';
import { escapeHtml } from './email/templates.js';
import { workspaceSender } from './workspace-brand.js';
import { appUrl } from '@thefibre/shared';

export type GoogleAccountRow = {
  id: string;
  workspace_id: string;
  member_id: string;
  person_id: string;
  status: 'suggested' | 'requested' | 'created' | 'declined';
  suggested_address: string | null;
  requested_address: string | null;
  note: string | null;
  created_address: string | null;
  decline_reason: string | null;
  requested_at: string | null;
  decided_at: string | null;
  admin_notified_at: string | null;
};

/** One admin email per member per this long, however often they change it. */
export const NOTIFY_QUIET_MS = 10 * 60 * 1000;

/** firstname.lastname — lowercased, accents stripped, anything else a dot. */
export function localPartFrom(first: string | null | undefined, last: string | null | undefined, fallback = 'member'): string {
  const clean = (s: string | null | undefined) =>
    (s ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
  const joined = [clean(first), clean(last)].filter(Boolean).join('.').replace(/\.{2,}/g, '.');
  return (joined || clean(fallback) || 'member').slice(0, 64);
}

/** What a member may ask for: letters, digits, dot, dash, underscore; 1–64. */
export function validLocalPart(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(s) && !s.includes('..');
}

/**
 * The member's OWN address when it is already in the community's Google
 * domain — they have the account (Sjoerd, 2026-10-17: "Iedereen die
 * inschrijft met een @soul.com adres laat hier natuurlijk dat adres zien").
 * Case-insensitive; the domain must match exactly, so a subdomain
 * (x@mail.soul.com) is not the community's. The same rule the grant worker
 * already follows (managedAddress in google-admin.ts).
 */
export function ownDomainAddress(email: string | null | undefined, domain: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase();
  const d = (domain ?? '').trim().toLowerCase();
  if (!e || !d) return null;
  const at = e.lastIndexOf('@');
  if (at < 1 || e.slice(at + 1) !== d) return null;
  return e;
}

/** The community's Google domain when Google is connected — from settings
 *  alone, without minting a token. */
async function connectedGoogleDomain(workspaceId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('membership_settings')
    .select('google_sa_json, google_admin_email')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!data?.google_sa_json || !data.google_admin_email) return null;
  return googleDomainOf(data.google_admin_email as string);
}

/**
 * The card for a member whose own email is on the domain: their account
 * exists, as itself — no suggestion, no request, no admin email. Derived at
 * read time; nothing is written. An address an admin explicitly marked
 * created still wins (the worker reads it first too). Null when the member's
 * email is elsewhere, or Google is not connected.
 */
export async function ownGoogleAccountView(member: { id: string; workspace_id: string; person_id: string }) {
  const domain = await connectedGoogleDomain(member.workspace_id);
  if (!domain) return null;
  const { data: person } = await adminClient
    .from('person')
    .select('email')
    .eq('id', member.person_id)
    .eq('workspace_id', member.workspace_id)
    .maybeSingle();
  const own = ownDomainAddress(person?.email as string | null, domain);
  if (!own) return null;
  const { data: row } = await adminClient
    .from('membership_google_account')
    .select('*')
    .eq('member_id', member.id)
    .eq('workspace_id', member.workspace_id)
    .maybeSingle();
  const r = row as GoogleAccountRow | null;
  if (r?.status === 'created' && r.created_address) return memberView({ row: r, domain });
  return ownAddressView(own, domain);
}

/** Does this membership include a Google account? Its access journal holds a
 *  google_user grant — the same source the worker reads. */
export async function googleApplies(memberId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from('membership_member_access')
    .select('id, grant:access_grant_id (kind)')
    .eq('member_id', memberId);
  if (error) throw new Error(`google applies: ${error.message}`);
  return (data ?? []).some((r) => {
    const g = (Array.isArray(r.grant) ? r.grant[0] : r.grant) as { kind?: string } | null;
    return g?.kind === 'google_user';
  });
}

async function takenInWorkspace(workspaceId: string, address: string, exceptMemberId: string): Promise<boolean> {
  const a = address.toLowerCase();
  const { data, error } = await adminClient
    .from('membership_google_account')
    .select('member_id, suggested_address, requested_address, created_address')
    .eq('workspace_id', workspaceId);
  if (error) throw new Error(`google addresses: ${error.message}`);
  return (data ?? []).some(
    (r) =>
      r.member_id !== exceptMemberId &&
      [r.suggested_address, r.requested_address, r.created_address].some((x) => (x as string | null)?.toLowerCase() === a),
  );
}

/** The first free firstname.lastname[.N]@domain: free here, and (when Google
 *  answers) not an existing account. A Google lookup that fails does not
 *  block a suggestion — the admin checks when they create it. */
async function freeAddress(workspaceId: string, memberId: string, base: string, domain: string, token: string | null): Promise<string> {
  for (let n = 1; n <= 20; n++) {
    const address = `${n === 1 ? base : `${base}.${n}`}@${domain}`;
    if (await takenInWorkspace(workspaceId, address, memberId)) continue;
    if (token) {
      try {
        if (await googleUserExists(token, address)) continue;
      } catch (e) {
        console.error('[google-account] lookup failed; suggesting without it', e);
      }
    }
    return address;
  }
  return `${base}.${Date.now().toString(36)}@${domain}`;
}

/**
 * The member's row, made with its suggestion on the first ask. INSERT OR
 * NOTHING on UNIQUE(member_id), then read back: two tabs opening the card at
 * once store one suggestion (B3's review).
 */
export async function ensureGoogleAccount(member: { id: string; workspace_id: string; person_id: string }): Promise<{ row: GoogleAccountRow; domain: string } | null> {
  const t = await googleTokenFor(member.workspace_id);
  if ('error' in t) return null;
  const read = async () =>
    (await adminClient.from('membership_google_account').select('*').eq('member_id', member.id).eq('workspace_id', member.workspace_id).maybeSingle())
      .data as GoogleAccountRow | null;
  const existing = await read();
  if (existing) return { row: existing, domain: t.domain };
  const { data: person } = await adminClient.from('person').select('first_name, last_name, email').eq('id', member.person_id).maybeSingle();
  const base = localPartFrom(
    person?.first_name as string | null,
    person?.last_name as string | null,
    ((person?.email as string | null) ?? '').split('@')[0],
  );
  const suggested = await freeAddress(member.workspace_id, member.id, base, t.domain, t.token);
  await adminClient.from('membership_google_account').upsert(
    { workspace_id: member.workspace_id, member_id: member.id, person_id: member.person_id, status: 'suggested', suggested_address: suggested },
    { onConflict: 'member_id', ignoreDuplicates: true },
  );
  const row = await read();
  return row ? { row, domain: t.domain } : null;
}

/** The member accepts the suggestion, or asks for `localPart` instead. */
export async function requestGoogleAccount(
  row: GoogleAccountRow,
  domain: string,
  ask: { localPart?: string; note?: string | null },
): Promise<{ row: GoogleAccountRow } | { error: string; code: string; status: 400 | 409 }> {
  if (row.status === 'created') return { error: 'your Google account already exists', code: 'already_created', status: 409 };
  let address = row.suggested_address;
  if (ask.localPart !== undefined) {
    const lp = ask.localPart.trim().toLowerCase();
    if (!validLocalPart(lp)) return { error: 'use letters, numbers, dots, dashes or underscores', code: 'bad_local_part', status: 400 };
    address = `${lp}@${domain}`;
    if (await takenInWorkspace(row.workspace_id, address, row.member_id)) {
      return { error: 'that address is already taken', code: 'address_taken', status: 409 };
    }
  }
  if (!address) return { error: 'no address to request', code: 'no_address', status: 400 };
  const now = new Date();
  const changed = row.status !== 'requested' || row.requested_address?.toLowerCase() !== address.toLowerCase();
  const { data, error } = await adminClient
    .from('membership_google_account')
    .update({
      status: 'requested',
      requested_address: address,
      note: ask.note?.trim() || null,
      requested_at: now.toISOString(),
      // decline_reason stays until the NEW request is decided (B3's review):
      // the admin sees why the last one was declined.
      updated_at: now.toISOString(),
    })
    .eq('id', row.id)
    .eq('workspace_id', row.workspace_id)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') return { error: 'that address is already taken', code: 'address_taken', status: 409 };
    throw new Error(error.message);
  }
  const saved = data as GoogleAccountRow;
  if (changed) await notifyAdmins(saved, now);
  return { row: saved };
}

/** One email per member per quiet window, to the workspace admins. */
async function notifyAdmins(row: GoogleAccountRow, now: Date): Promise<void> {
  if (row.admin_notified_at && now.getTime() - Date.parse(row.admin_notified_at) < NOTIFY_QUIET_MS) return;
  // Claim the window first, so two quick asks race to ONE email.
  const cutoff = new Date(now.getTime() - NOTIFY_QUIET_MS).toISOString();
  const { data: claimed } = await adminClient
    .from('membership_google_account')
    .update({ admin_notified_at: now.toISOString() })
    .eq('id', row.id)
    .or(`admin_notified_at.is.null,admin_notified_at.lt.${cutoff}`)
    .select('id');
  if (!claimed?.length) return;

  const [{ data: admins }, { data: person }] = await Promise.all([
    adminClient
      .from('workspace_member')
      .select('user:user_id (email)')
      .eq('workspace_id', row.workspace_id)
      .in('workspace_role', ['admin', 'super_admin']),
    adminClient.from('person').select('first_name, last_name, email').eq('id', row.person_id).maybeSingle(),
  ]);
  const to = [
    ...new Set(
      (admins ?? [])
        .map((a) => ((Array.isArray(a.user) ? a.user[0] : a.user) as { email?: string } | null)?.email)
        .filter((e): e is string => !!e),
    ),
  ];
  if (!to.length) return;
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ') || (person?.email as string) || 'A member';
  const list = `${appUrl('membership', process.env as Record<string, string>)}/settings/google-accounts`;
  const text = [
    `${name} would like a Google Workspace account:`,
    '',
    `    ${row.requested_address}`,
    row.note ? `\nTheir note: ${row.note}` : '',
    '',
    'Create it in the Google Admin console, then mark it as created in Members — their access follows within minutes.',
    '',
    `Requests: ${list}`,
  ].join('\n');
  const html = `<p style="font-size:14px;line-height:1.6;color:#171717;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  const sender = await workspaceSender(row.workspace_id);
  for (const addr of to) {
    try {
      await sendEmail({ to: addr, subject: `Google account requested: ${row.requested_address}`, text, html, ...sender });
    } catch (e) {
      console.error('[google-account] admin email failed (non-fatal)', { to: addr, error: e });
    }
  }
}

/** The admin made the account: record the address and re-queue the member's
 *  Google grant, so access follows within a tick. */
export async function markGoogleAccountCreated(
  workspaceId: string,
  id: string,
  address: string,
  actorUserId: string,
): Promise<{ row: GoogleAccountRow } | { error: string; status: 400 | 404 | 409 }> {
  const t = await googleTokenFor(workspaceId);
  const domain = 'error' in t ? null : t.domain;
  const a = address.trim().toLowerCase();
  if (!domain || !a.endsWith(`@${domain}`) || !validLocalPart(a.split('@')[0]!)) {
    return { error: domain ? `the address must be @${domain}` : 'Google is not connected', status: 400 };
  }
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from('membership_google_account')
    .update({ status: 'created', created_address: a, decline_reason: null, decided_at: now, decided_by_user_id: actorUserId || null, updated_at: now })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .maybeSingle();
  if (error) return { error: error.code === '23505' ? 'another member already has that address' : error.message, status: error.code === '23505' ? 409 : 400 };
  if (!data) return { error: 'not found', status: 404 };
  const row = data as GoogleAccountRow;
  await requeueGoogleGrant(row.member_id);
  return { row };
}

/** Declined: the member sees why. Re-queues NOTHING. */
export async function declineGoogleAccount(
  workspaceId: string,
  id: string,
  reason: string,
  actorUserId: string,
): Promise<{ row: GoogleAccountRow } | { error: string; status: 404 }> {
  const now = new Date().toISOString();
  const { data } = await adminClient
    .from('membership_google_account')
    .update({ status: 'declined', decline_reason: reason.trim() || null, decided_at: now, decided_by_user_id: actorUserId || null, updated_at: now })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .neq('status', 'created')
    .select('*')
    .maybeSingle();
  if (!data) return { error: 'not found', status: 404 };
  return { row: data as GoogleAccountRow };
}

/** The member's google_user journal rows that have not been granted yet go
 *  back to pending, so the next tick syncs them on the new address. */
async function requeueGoogleGrant(memberId: string): Promise<void> {
  const { data } = await adminClient
    .from('membership_member_access')
    .select('id, status, grant:access_grant_id (kind)')
    .eq('member_id', memberId)
    .in('status', ['pending', 'error']);
  const ids = (data ?? [])
    .filter((r) => ((Array.isArray(r.grant) ? r.grant[0] : r.grant) as { kind?: string } | null)?.kind === 'google_user')
    .map((r) => r.id as string);
  if (!ids.length) return;
  await adminClient
    .from('membership_member_access')
    .update({ status: 'pending', last_error: null, updated_at: new Date().toISOString() })
    .in('id', ids);
}

/** The member-facing shape (B3's card). `own_address` (additive,
 *  2026-10-17): the created address is the member's own email, already on
 *  the domain. */
export function memberView(r: { row: GoogleAccountRow; domain: string } | null) {
  if (!r) {
    return { applies: false, domain: null, status: 'none' as const, suggested_address: null, requested_address: null, created_address: null, note: null, decline_reason: null, own_address: false };
  }
  const { row, domain } = r;
  return {
    own_address: false,
    applies: true,
    domain,
    status: row.status,
    suggested_address: row.suggested_address,
    requested_address: row.requested_address,
    created_address: row.created_address,
    note: row.note,
    decline_reason: row.decline_reason,
  };
}

/** The card for a member whose own email IS their Google account. */
export function ownAddressView(address: string, domain: string) {
  return {
    applies: true,
    domain,
    status: 'created' as const,
    suggested_address: null,
    requested_address: null,
    created_address: address,
    note: null,
    decline_reason: null,
    own_address: true,
  };
}
