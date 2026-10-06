// The Resend Domains wrapper, against a fake transport: the requests it makes
// and how it reads what comes back. No key, no network. What this cannot
// prove — that Resend's live answer has this shape — the staging flow does.

import { describe, expect, it } from 'vitest';
import { RESEND_REGION, ResendDomainError, resendDomains } from './resend-domains.js';

type Call = { url: string; init: RequestInit };

function fake(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { status: 500, body: { name: 'none', message: 'no response queued' } };
    const text = next.body === undefined ? '' : JSON.stringify(next.body);
    return new Response(text, { status: next.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('resendDomains', () => {
  it('is null without a key — the routes answer 503, mail stays a logged no-op', () => {
    expect(resendDomains(undefined, fake([]).fetchImpl)).toBeNull();
    expect(resendDomains('', fake([]).fetchImpl)).toBeNull();
  });

  it('creates a domain in the EU region with the bearer key, and returns the answer', async () => {
    const { calls, fetchImpl } = fake([{ status: 201, body: { id: 'd_1', name: 'soul.com', status: 'not_started', region: 'eu-west-1', records: [] } }]);
    const d = await resendDomains('re_test', fetchImpl)!.create('soul.com');
    expect(d.id).toBe('d_1');
    expect(calls[0]!.url).toBe('https://api.resend.com/domains');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ name: 'soul.com', region: RESEND_REGION });
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
  });

  it('verify posts to /verify and expects nothing back; get reads the domain', async () => {
    const { calls, fetchImpl } = fake([
      { status: 200, body: { object: 'domain', id: 'd_1' } },
      { status: 200, body: { id: 'd_1', name: 'soul.com', status: 'pending', region: 'eu-west-1', records: [{ record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'p=x', status: 'pending' }] } },
    ]);
    const c = resendDomains('re_test', fetchImpl)!;
    await c.verify('d_1');
    const d = await c.get('d_1');
    expect(calls.map((x) => `${x.init.method} ${x.url}`)).toEqual([
      'POST https://api.resend.com/domains/d_1/verify',
      'GET https://api.resend.com/domains/d_1',
    ]);
    expect(d.records[0]!.status).toBe('pending');
  });

  it('turns an error body into a ResendDomainError with Resend’s name and message', async () => {
    const { fetchImpl } = fake([{ status: 403, body: { statusCode: 403, name: 'validation_error', message: 'The soul.com domain has been registered already.' } }]);
    await expect(resendDomains('re_test', fetchImpl)!.create('soul.com')).rejects.toMatchObject({
      status: 403,
      name: 'validation_error',
      message: 'The soul.com domain has been registered already.',
    } satisfies Partial<ResendDomainError>);
  });

  it('list returns names and statuses only — never the records or anything with a key in it', async () => {
    const { fetchImpl } = fake([{ status: 200, body: { data: [{ id: 'd_1', name: 'thefibre.app', status: 'verified', region: 'eu-west-1', records: [{ value: 'p=secret-looking' }], created_at: '2026-01-01' }] } }]);
    const list = await resendDomains('re_test', fetchImpl)!.list();
    expect(list).toEqual([{ id: 'd_1', name: 'thefibre.app', status: 'verified', region: 'eu-west-1', created_at: '2026-01-01' }]);
  });
});
