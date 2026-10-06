// A workspace's own domains — the `workspace_domain` rows and the three
// pure rules around them (docs/domain-package.md).
//
// The rule that matters for mail: a sender ADDRESS only takes effect once the
// domain it is on is a `verified` email row of that workspace. Until then the
// address is treated as unset and the platform's own goes out, with the
// workspace's name — the fallback lib/email/client.ts has always had, reached
// one step earlier so Resend is not asked and refused on every send.
//
// A workspace that typed an address BEFORE this existed (festival-of-trust,
// the default workspace on 2026-10-06) has no row at all. Those keep the old
// behaviour — the address is tried, and Resend decides — because some of
// them are verified by hand in the Resend dashboard and a row we do not have
// cannot say so. `adoptVerifiedDomains()` (admin route) turns those into rows
// from the provider's own list, after which the rule above is the only one.

import { adminClient } from '../db.js';
import { row, rows } from './rows.js';
import type { ResendDomain, ResendRecord, ResendRecordStatus } from './resend-domains.js';

export type DomainKind = 'email' | 'web';

export type WorkspaceDomainRow = {
  id: string;
  workspace_id: string;
  kind: DomainKind;
  host: string;
  provider: 'resend' | 'vercel';
  provider_id: string | null;
  status: ResendRecordStatus | string;
  records: ResendRecord[];
  verified_at: string | null;
  checked_at: string | null;
  created_at: string;
};

const HOST = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** `Office@Soul.com ` → `soul.com`; null when it is not an address. */
export function domainOfAddress(address: string | null | undefined): string | null {
  const m = /^[^@\s]+@([^@\s]+)$/.exec((address ?? '').trim());
  if (!m) return null;
  const host = m[1]!.toLowerCase();
  return HOST.test(host) ? host : null;
}

/** A bare host, lowercased, or null. Refuses an address, a URL, a path. */
export function normaliseHost(input: string | null | undefined): string | null {
  const host = (input ?? '').trim().toLowerCase().replace(/\.$/, '');
  return HOST.test(host) ? host : null;
}

/**
 * The gate: does this workspace have a verified email domain that the
 * address is on? Reads one row. `null` address → false without a query.
 *
 * Returns `null` (not false) when the workspace has NO email row for that
 * host at all, so the caller can tell "not verified" from "never started"
 * and keep the legacy behaviour for the second.
 */
export async function senderDomainState(
  workspaceId: string,
  address: string | null | undefined,
): Promise<'verified' | 'unverified' | null> {
  const host = domainOfAddress(address);
  if (!host) return null;
  const r = row(
    'workspace_domain for sender',
    await adminClient
      .from('workspace_domain')
      .select('status')
      .eq('workspace_id', workspaceId)
      .eq('kind', 'email')
      .eq('host', host)
      .maybeSingle(),
  ) as { status: string } | null;
  if (!r) return null;
  return r.status === 'verified' ? 'verified' : 'unverified';
}

/** The workspace's email-domain row, if it has started one. */
export async function emailDomainOf(workspaceId: string): Promise<WorkspaceDomainRow | null> {
  const list = rows(
    'workspace_domain',
    await adminClient
      .from('workspace_domain')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('kind', 'email')
      .order('created_at', { ascending: false })
      .limit(1),
  ) as WorkspaceDomainRow[];
  return list[0] ?? null;
}

/**
 * What to store from Resend's answer, and nothing else: the provider's
 * status, its records as given (name, type, value, priority, per-record
 * status), and `verified_at` the first time it says verified. The settings
 * page renders `records` straight from the row, so the shape is Resend's.
 */
export function rowPatchFromResend(d: ResendDomain, now = new Date()): {
  provider_id: string;
  status: ResendRecordStatus;
  records: ResendRecord[];
  checked_at: string;
  verified_at?: string;
} {
  const records = (d.records ?? []).map((r) => ({
    record: r.record,
    name: r.name,
    type: r.type,
    value: r.value,
    status: r.status,
    ...(r.ttl ? { ttl: r.ttl } : {}),
    ...(typeof r.priority === 'number' ? { priority: r.priority } : {}),
  }));
  return {
    provider_id: d.id,
    status: d.status,
    records,
    checked_at: now.toISOString(),
    ...(d.status === 'verified' ? { verified_at: now.toISOString() } : {}),
  };
}

/**
 * Resend gives record names RELATIVE to the domain ("send",
 * "resend._domainkey"); a registrar's form wants either that or the full
 * name, and people copy the wrong one. The page shows both. The apex itself
 * comes back as "" or "@" from some providers — normalised to "@".
 */
export function fullRecordName(relative: string, host: string): string {
  const rel = relative.trim().replace(/\.$/, '');
  if (!rel || rel === '@') return host;
  if (rel.endsWith(`.${host}`) || rel === host) return rel;
  return `${rel}.${host}`;
}
