// The hourly look at every verified customer web host (docs/domain-package.md
// part 2), run from the scheduler under a lease like its siblings.
//
// Why it exists: a verified host sits in the CORS allow-list with
// credentials, and the customer controls its DNS. If they re-point
// book.soul.com at their own server, our row would still say verified and
// their page would still be an allowed origin. The API authenticates from the
// Authorization header only, so that page could do nothing with it — but
// "could do nothing" is not the standard; "is no longer allowed" is. So:
// every verified web row not checked in the last hour is read back from
// Vercel, and when Vercel no longer sees the CNAME pointing at it (or the host
// is gone from the project), the row is demoted to pending — which drops it
// from the CORS set within the minute and from the middleware's answer at
// once. Re-verifying is the admin's Check button, as the first time.

import { adminClient } from '../db.js';
import { rows } from './rows.js';
import { _setTenantOrigins } from './tenant-origins.js';
import { vercelDomains, vercelProjectFor } from './vercel-domains.js';
import { verifiedWebOrigins, webRowPatchFromVercel, type WorkspaceDomainRow } from './workspace-domain.js';

const RECHECK_AFTER_MS = 60 * 60 * 1000;

export async function runWebDomainRecheck(now = new Date()): Promise<{ checked: number; demoted: string[] }> {
  const provider = vercelDomains();
  if (!provider) return { checked: 0, demoted: [] };
  const cutoff = new Date(now.getTime() - RECHECK_AFTER_MS).toISOString();
  const due = rows(
    'workspace_domain due for recheck',
    await adminClient
      .from('workspace_domain')
      .select('*')
      .eq('kind', 'web')
      .eq('status', 'verified')
      .or(`checked_at.is.null,checked_at.lt.${cutoff}`),
  ) as WorkspaceDomainRow[];

  const demoted: string[] = [];
  for (const r of due) {
    const project = r.app ? vercelProjectFor(r.app) : null;
    if (!project) continue;
    try {
      const [d, cfg] = await Promise.all([provider.get(project, r.host), provider.config(r.host).catch(() => null)]);
      const patch = webRowPatchFromVercel(r.host, d, cfg, now);
      delete (patch as { verified_at?: string }).verified_at; // the first date stands
      if (patch.status !== 'verified') demoted.push(r.host);
      const { error } = await adminClient.from('workspace_domain').update(patch).eq('id', r.id);
      if (error) console.error('[domains/recheck] update failed', r.host, error.message);
    } catch (e) {
      // Vercel 404 = the host is no longer on the project: demote. Anything
      // else (network, 5xx) keeps the row as it is and tries again next hour.
      const status = (e as { status?: number }).status;
      if (status === 404) {
        demoted.push(r.host);
        const { error } = await adminClient
          .from('workspace_domain')
          .update({ status: 'pending', checked_at: now.toISOString() })
          .eq('id', r.id);
        if (error) console.error('[domains/recheck] demote failed', r.host, error.message);
      } else {
        console.warn('[domains/recheck] could not read', r.host, e instanceof Error ? e.message : e);
      }
    }
  }
  if (demoted.length) {
    console.warn('[domains/recheck] demoted (DNS no longer points at us):', demoted.join(', '));
    _setTenantOrigins(await verifiedWebOrigins().catch(() => []));
  }
  return { checked: due.length, demoted };
}
