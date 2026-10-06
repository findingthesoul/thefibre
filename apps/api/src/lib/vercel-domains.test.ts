// The Vercel project-domains wrapper against a fake transport: the requests
// it makes (project by name, team in the query, the staging branch on the
// staging API) and how it reads what comes back. No token, no network.

import { describe, expect, it } from 'vitest';
import {
  gitBranchFor,
  plainVercelError,
  VercelDomainError,
  vercelDomains,
  vercelProjectFor,
} from './vercel-domains.js';

type Call = { url: string; init: RequestInit };
function fake(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { status: 500, body: { error: { code: 'none', message: 'no response queued' } } };
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('vercelDomains', () => {
  it('is null without a token', () => {
    expect(vercelDomains({}, fake([]).fetchImpl)).toBeNull();
  });

  it('adds a host to the project by name, with the team and — on staging — the staging branch', async () => {
    const { calls, fetchImpl } = fake([{ status: 200, body: { name: 'book.soul.com', apexName: 'soul.com', verified: true } }]);
    const c = vercelDomains({ VERCEL_API_TOKEN: 't', VERCEL_TEAM_ID: 'team_1', FLY_APP_NAME: 'thefibre-api-staging' }, fetchImpl)!;
    const d = await c.add('thefibre-meet', 'book.soul.com');
    expect(d.verified).toBe(true);
    expect(calls[0]!.url).toBe('https://api.vercel.com/v10/projects/thefibre-meet/domains?teamId=team_1');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ name: 'book.soul.com', gitBranch: 'staging' });
  });

  it('on production sends no branch, and no team when there is none', async () => {
    const { calls, fetchImpl } = fake([{ status: 200, body: { name: 'book.soul.com', apexName: 'soul.com', verified: false, verification: [{ type: 'TXT', domain: '_vercel.soul.com', value: 'vc-domain-verify=…', reason: 'pending_domain_verification' }] } }]);
    const d = await vercelDomains({ VERCEL_API_TOKEN: 't', FLY_APP_NAME: 'thefibre-api' }, fetchImpl)!.add('thefibre-thread', 'events.soul.com');
    expect(calls[0]!.url).toBe('https://api.vercel.com/v10/projects/thefibre-thread/domains');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ name: 'events.soul.com' });
    expect(d.verification?.[0]?.type).toBe('TXT');
  });

  it('reads a domain config defensively — misconfigured and the recommended CNAME, raw kept', async () => {
    const { calls, fetchImpl } = fake([{ status: 200, body: { misconfigured: true, configuredBy: null, recommendedCNAME: ['cname.vercel-dns.com'], extra: 1 } }]);
    const cfg = await vercelDomains({ VERCEL_API_TOKEN: 't' }, fetchImpl)!.config('book.soul.com');
    expect(calls[0]!.url).toBe('https://api.vercel.com/v6/domains/book.soul.com/config');
    expect(cfg.misconfigured).toBe(true);
    expect(cfg.recommendedCNAME).toEqual(['cname.vercel-dns.com']);
    expect(cfg.raw.extra).toBe(1);
  });

  it('verify and remove hit the v9 project-domain paths', async () => {
    const { calls, fetchImpl } = fake([{ status: 200, body: { name: 'x', apexName: 'x', verified: true } }, { status: 200, body: {} }]);
    const c = vercelDomains({ VERCEL_API_TOKEN: 't' }, fetchImpl)!;
    await c.verify('thefibre-meet', 'book.soul.com');
    await c.remove('thefibre-meet', 'book.soul.com');
    expect(calls.map((x) => `${x.init.method} ${x.url}`)).toEqual([
      'POST https://api.vercel.com/v9/projects/thefibre-meet/domains/book.soul.com/verify',
      'DELETE https://api.vercel.com/v9/projects/thefibre-meet/domains/book.soul.com',
    ]);
  });

  it('turns Vercel’s error envelope into a VercelDomainError with its code', async () => {
    const { fetchImpl } = fake([{ status: 409, body: { error: { code: 'domain_already_in_use', message: 'The domain is already assigned to another Vercel project' } } }]);
    await expect(vercelDomains({ VERCEL_API_TOKEN: 't' }, fetchImpl)!.add('thefibre-meet', 'book.soul.com')).rejects.toMatchObject({
      status: 409,
      code: 'domain_already_in_use',
    });
  });
});

describe('the small rules', () => {
  it('gitBranchFor: staging only on the staging API', () => {
    expect(gitBranchFor({ FLY_APP_NAME: 'thefibre-api-staging' })).toBe('staging');
    expect(gitBranchFor({ FLY_APP_NAME: 'thefibre-api' })).toBeNull();
    expect(gitBranchFor({})).toBeNull();
  });
  it('vercelProjectFor: only the two apps with public pages', () => {
    expect(vercelProjectFor('fibre-meet')).toBe('thefibre-meet');
    expect(vercelProjectFor('the-thread')).toBe('thefibre-thread');
    expect(vercelProjectFor('fibre-platform')).toBeNull();
  });
  it('plainVercelError: 409 is "in use elsewhere" in words, the rest passes through', () => {
    expect(plainVercelError(new VercelDomainError(409, 'domain_already_in_use', 'x'))).toMatchObject({ status: 409 });
    expect(plainVercelError(new VercelDomainError(409, 'domain_already_in_use', 'x')).error).toMatch(/already in use/);
    expect(plainVercelError(new VercelDomainError(429, 'rate', 'x')).status).toBe(503);
    expect(plainVercelError(new TypeError('fetch failed')).status).toBe(502);
  });
});
