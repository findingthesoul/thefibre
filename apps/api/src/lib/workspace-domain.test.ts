// The pure rules of the domain package (docs/domain-package.md): what counts
// as a domain, what is stored from the provider's answer, and how a DNS name
// is shown. The database-touching halves are exercised by the routes on
// staging; these are the parts a wrong regex would break for everyone.

import { describe, expect, it } from 'vitest';
import { domainOfAddress, fullRecordName, normaliseHost, rowPatchFromResend } from './workspace-domain.js';
import { plainResendError, ResendDomainError } from './resend-domains.js';

describe('domainOfAddress', () => {
  it('takes the host out of an address, lowercased', () => {
    expect(domainOfAddress(' Office@Soul.com ')).toBe('soul.com');
    expect(domainOfAddress('hello@updates.soul.com')).toBe('updates.soul.com');
  });
  it('is null for anything that is not one address', () => {
    for (const bad of [null, undefined, '', 'soul.com', '@soul.com', 'a@b', 'a@b@c.com', 'a b@soul.com']) {
      expect(domainOfAddress(bad), String(bad)).toBeNull();
    }
  });
});

describe('normaliseHost', () => {
  it('accepts a bare host and lowercases it', () => {
    expect(normaliseHost('Soul.com')).toBe('soul.com');
    expect(normaliseHost('book.soul.com.')).toBe('book.soul.com');
  });
  it('refuses an address, a URL, a path and a label that is too long', () => {
    for (const bad of ['office@soul.com', 'https://soul.com', 'soul.com/book', 'soul', `${'a'.repeat(64)}.com`, '']) {
      expect(normaliseHost(bad), bad).toBeNull();
    }
  });
});

describe('rowPatchFromResend', () => {
  const answer = {
    id: 'd_1',
    name: 'soul.com',
    status: 'pending' as const,
    region: 'eu-west-1',
    records: [
      { record: 'SPF', name: 'send', type: 'MX', value: 'feedback-smtp.eu-west-1.amazonses.com', priority: 10, ttl: 'Auto', status: 'verified' as const },
      { record: 'SPF', name: 'send', type: 'TXT', value: 'v=spf1 include:amazonses.com ~all', ttl: 'Auto', status: 'not_started' as const },
      { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'p=MIGf…', ttl: 'Auto', status: 'verified' as const },
    ],
  };
  const now = new Date('2026-10-06T14:00:00Z');

  it('keeps the provider id, status and records as given, with a checked_at', () => {
    const p = rowPatchFromResend(answer, now);
    expect(p.provider_id).toBe('d_1');
    expect(p.status).toBe('pending');
    expect(p.records).toHaveLength(3);
    expect(p.records[0]).toMatchObject({ type: 'MX', priority: 10, status: 'verified' });
    expect(p.records[1]).not.toHaveProperty('priority');
    expect(p.checked_at).toBe('2026-10-06T14:00:00.000Z');
    expect(p).not.toHaveProperty('verified_at');
  });

  it('stamps verified_at only when the provider says verified', () => {
    const p = rowPatchFromResend({ ...answer, status: 'verified' }, now);
    expect(p.verified_at).toBe('2026-10-06T14:00:00.000Z');
  });

  it('survives an answer with no records array', () => {
    expect(rowPatchFromResend({ ...answer, records: undefined as never }, now).records).toEqual([]);
  });
});

describe('fullRecordName', () => {
  it('appends the host to a relative name', () => {
    expect(fullRecordName('send', 'soul.com')).toBe('send.soul.com');
    expect(fullRecordName('resend._domainkey', 'soul.com')).toBe('resend._domainkey.soul.com');
  });
  it('leaves an already-full name alone and shows the apex as the host', () => {
    expect(fullRecordName('send.soul.com', 'soul.com')).toBe('send.soul.com');
    expect(fullRecordName('@', 'soul.com')).toBe('soul.com');
    expect(fullRecordName('', 'soul.com')).toBe('soul.com');
  });
});

describe('plainResendError', () => {
  it('turns "registered already" into the sentence about another account, as a 409', () => {
    const r = plainResendError(new ResendDomainError(403, 'validation_error', 'The soul.com domain has been registered already.'));
    expect(r.status).toBe(409);
    expect(r.error).toMatch(/another account/);
    expect(r.error).toMatch(/nothing you add in DNS/);
  });
  it('passes other refusals through as a 502 with the provider message', () => {
    const r = plainResendError(new ResendDomainError(422, 'validation_error', 'Invalid domain name.'));
    expect(r.status).toBe(502);
    expect(r.error).toContain('Invalid domain name.');
  });
  it('rate limits are a 503, and a non-Resend failure is a 502 without detail', () => {
    expect(plainResendError(new ResendDomainError(429, 'rate_limit_exceeded', 'Too many requests')).status).toBe(503);
    expect(plainResendError(new TypeError('fetch failed')).status).toBe(502);
  });
});
