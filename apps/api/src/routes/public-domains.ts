// What a customer host serves — asked by the Meet and Thread middleware for
// every request that arrives on a host that is not the app's own
// (docs/domain-package.md, part 2). Mounted at /api/v1/public/domains, no
// session: the answer is the same for everyone and holds nothing personal
// (an app slug, a public URL segment, the workspace's public slug).
//
//   GET /resolve?host=book.soul.com
//     200 {app, root_slug, workspace_slug}   — verified host
//     404 {error}                            — unknown, unverified, or no host
//
// Cached for a minute on both sides (Cache-Control here, an in-memory map in
// the middleware), so the database sees one lookup per host per minute, not
// one per request.

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { row } from '../lib/rows.js';
import { normaliseHost, resolveWebHost } from '../lib/workspace-domain.js';

export const publicDomainsRoutes = new Hono();

publicDomainsRoutes.get('/resolve', async (c) => {
  const host = normaliseHost(c.req.query('host'));
  c.header('Cache-Control', 'public, max-age=60');
  if (!host) return c.json({ error: 'host required' }, 404);
  let resolved;
  try {
    resolved = await resolveWebHost(host);
  } catch (e) {
    console.warn('[public-domains] resolve failed', host, e instanceof Error ? e.message : e);
    return c.json({ error: 'lookup failed' }, 503);
  }
  if (!resolved) return c.json({ error: 'unknown host' }, 404);
  const ws = row(
    'workspace slug',
    await adminClient.from('workspace').select('slug').eq('id', resolved.workspace_id).maybeSingle(),
  ) as { slug: string } | null;
  return c.json({ app: resolved.app, root_slug: resolved.root_slug, workspace_slug: ws?.slug ?? null });
});
