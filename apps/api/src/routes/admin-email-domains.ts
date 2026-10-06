// What the mail provider account behind THIS stack's key holds — super admin
// only. Mounted at /api/v1/admin/email-domains.
//
// Two questions this answers without a dashboard login (docs/domain-package.md):
//   - is staging's RESEND_API_KEY the same Resend team as production's? List
//     both stacks and compare the names.
//   - where does soul.com sit? Its DNS carried a half-finished Resend setup on
//     2026-10-06; whichever stack lists it is the account that owns it.
//
// `adopt` turns the provider's VERIFIED domains into `workspace_domain` rows
// for the workspaces whose sender address is on them — the workspaces that
// typed an address before the domain page existed and were verified by hand
// in the dashboard. After adoption the one rule applies to them too
// (lib/workspace-domain.ts header). Idempotent; it never touches a row that
// exists and never writes an unverified domain.
//
// Names and statuses only. Never the records, never the key.

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { isSuperAdminUser } from '../lib/super-admin.js';
import { resendDomains } from '../lib/resend-domains.js';
import { rows } from '../lib/rows.js';
import { domainOfAddress, rowPatchFromResend } from '../lib/workspace-domain.js';

export const adminEmailDomainsRoutes = new Hono();

adminEmailDomainsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const provider = resendDomains();
  if (!provider) return c.json({ configured: false, domains: [] });
  try {
    const domains = await provider.list();
    const claimed = rows(
      'workspace_domain',
      await adminClient.from('workspace_domain').select('host, workspace_id, status').eq('kind', 'email'),
    ) as { host: string; workspace_id: string; status: string }[];
    return c.json({
      configured: true,
      domains: domains.map((d) => ({
        ...d,
        claimed_by: claimed.find((w) => w.host === d.name.toLowerCase())?.workspace_id ?? null,
      })),
    });
  } catch (e) {
    console.warn('[admin-email-domains] list failed', e instanceof Error ? e.message : e);
    return c.json({ error: 'Our mail provider did not answer.' }, 502);
  }
});

adminEmailDomainsRoutes.post('/adopt', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const provider = resendDomains();
  if (!provider) return c.json({ error: 'Email is not configured on this server.' }, 503);

  const [domains, wsRes, claimedRes] = await Promise.all([
    provider.list(),
    adminClient.from('workspace').select('id, slug, email_from_address').not('email_from_address', 'is', null),
    adminClient.from('workspace_domain').select('host').eq('kind', 'email'),
  ]);
  const workspaces = rows('workspaces with a sender address', wsRes) as {
    id: string;
    slug: string;
    email_from_address: string;
  }[];
  const claimed = rows('workspace_domain', claimedRes) as { host: string }[];
  const have = new Set(claimed.map((r) => r.host));
  const adopted: { host: string; workspace: string }[] = [];
  const skipped: { host: string; why: string }[] = [];

  for (const d of domains) {
    const host = d.name.toLowerCase();
    if (have.has(host)) continue;
    if (d.status !== 'verified') {
      skipped.push({ host, why: `provider says ${d.status}` });
      continue;
    }
    const owners = workspaces.filter((w) => domainOfAddress(w.email_from_address) === host);
    if (owners.length !== 1) {
      skipped.push({ host, why: owners.length === 0 ? 'no workspace sends from it' : 'several workspaces send from it' });
      continue;
    }
    const full = await provider.get(d.id);
    const { error } = await adminClient
      .from('workspace_domain')
      .insert({ workspace_id: owners[0]!.id, kind: 'email', host, provider: 'resend', ...rowPatchFromResend(full) });
    if (error) skipped.push({ host, why: error.message });
    else adopted.push({ host, workspace: owners[0]!.slug });
  }
  return c.json({ adopted, skipped });
});
