// The dynamic CORS half: a verified customer host is allowed, anything else
// is not, and the set is what was last loaded — never a guess.

import { describe, expect, it } from 'vitest';
import { _setTenantOrigins, isTenantOrigin } from './tenant-origins.js';
import { webRowPatchFromVercel } from './workspace-domain.js';

describe('isTenantOrigin', () => {
  it('allows exactly the origins in the set', () => {
    const now = 1_000_000;
    _setTenantOrigins(['https://book.soul.com'], now);
    expect(isTenantOrigin('https://book.soul.com', now)).toBe(true);
    expect(isTenantOrigin('https://evil.example', now)).toBe(false);
    expect(isTenantOrigin('http://book.soul.com', now)).toBe(false);
  });

  it('matches the exact origin only — no suffix, prefix or sub-host trap', () => {
    const now = 2_000_000;
    _setTenantOrigins(['https://book.soul.com'], now);
    for (const o of [
      'https://book.soul.com.evil.example', // our host as a prefix of theirs
      'https://evil-book.soul.com', // ours as a suffix
      'https://xbook.soul.com',
      'https://sub.book.soul.com',
      'https://book.soul.com:8443',
      'https://soul.com',
      'https://BOOK.SOUL.COM',
    ]) {
      expect(isTenantOrigin(o, now), o).toBe(false);
    }
    expect(isTenantOrigin('https://book.soul.com', now)).toBe(true);
  });
});

describe('webRowPatchFromVercel', () => {
  const domain = { name: 'book.soul.com', apexName: 'soul.com', projectId: 'prj_1', verified: true };
  const now = new Date('2026-10-06T15:00:00Z');

  it('is verified only when Vercel accepts the host AND the DNS points at it', () => {
    const ok = webRowPatchFromVercel('book.soul.com', domain, { misconfigured: false, raw: {} }, now);
    expect(ok.status).toBe('verified');
    expect(ok.verified_at).toBe(now.toISOString());
    expect(ok.records[0]).toMatchObject({ type: 'CNAME', name: 'book.soul.com', value: 'cname.vercel-dns.com', status: 'verified' });

    const dnsMissing = webRowPatchFromVercel('book.soul.com', domain, { misconfigured: true, raw: {} }, now);
    expect(dnsMissing.status).toBe('pending');
    expect(dnsMissing).not.toHaveProperty('verified_at');
    expect(dnsMissing.records[0]!.status).toBe('pending');
  });

  it('adds the ownership TXT challenge when Vercel asks for one, pending until verified', () => {
    const p = webRowPatchFromVercel(
      'book.soul.com',
      { ...domain, verified: false, verification: [{ type: 'TXT', domain: '_vercel.soul.com', value: 'vc-domain-verify=abc', reason: 'pending_domain_verification' }] },
      { misconfigured: false, raw: {} },
      now,
    );
    expect(p.status).toBe('pending');
    expect(p.records).toHaveLength(2);
    expect(p.records[1]).toMatchObject({ record: 'OWNERSHIP', type: 'TXT', name: '_vercel.soul.com', status: 'pending' });
  });

  it('prefers the CNAME target Vercel recommends, and survives no config at all', () => {
    const p = webRowPatchFromVercel('book.soul.com', domain, { misconfigured: false, recommendedCNAME: ['abc.vercel-dns-017.com'], raw: {} }, now);
    expect(p.records[0]!.value).toBe('abc.vercel-dns-017.com');
    const none = webRowPatchFromVercel('book.soul.com', domain, null, now);
    expect(none.status).toBe('pending');
  });
});
