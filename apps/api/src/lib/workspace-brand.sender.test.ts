// The one sender rule (docs/domain-package.md), as every send path now reads
// it: the workspace's name or the platform's, the address only when the brand
// hands one out (which getWorkspaceBrand does only for a verified domain, or
// for a workspace that never started one), the reply-to when set.

import { describe, expect, it } from 'vitest';
import { ENTITY } from '@thefibre/shared';
import { senderOf } from './workspace-brand.js';

const brand = (over: Partial<Parameters<typeof senderOf>[0] & object> = {}) => ({
  logoUrl: null,
  fromName: null,
  fromAddress: null,
  replyTo: null,
  note: null,
  ...over,
});

describe('senderOf', () => {
  it('falls back to the platform name, never to an undefined name', () => {
    expect(senderOf(brand())).toEqual({ fromName: ENTITY.publicName });
    expect(senderOf(null)).toEqual({ fromName: ENTITY.publicName });
  });

  it('carries the three halves when the brand has them', () => {
    expect(senderOf(brand({ fromName: 'soul.com', fromAddress: 'office@soul.com', replyTo: 's@soul.com' }))).toEqual({
      fromName: 'soul.com',
      fromAddress: 'office@soul.com',
      replyTo: 's@soul.com',
    });
  });

  it('leaves out an address or reply-to the brand does not have, rather than sending undefined', () => {
    const s = senderOf(brand({ fromName: 'Festival of Trust' }));
    expect(s).toEqual({ fromName: 'Festival of Trust' });
    expect('fromAddress' in s).toBe(false);
    expect('replyTo' in s).toBe(false);
  });
});
