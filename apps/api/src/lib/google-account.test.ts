import { describe, expect, it } from 'vitest';
import { localPartFrom, ownDomainAddress, validLocalPart } from './google-account.js';
import { googleDomainOf, managedAddress } from './google-admin.js';

// The suggested address and which address the worker manages — the rules,
// with no database (google-account.int.test.ts runs them through the routes).
describe('localPartFrom — firstname.lastname', () => {
  it('lowercases, strips accents, turns everything else into one dot', () => {
    expect(localPartFrom('Ann', 'Lée')).toBe('ann.lee');
    expect(localPartFrom('Jean-Luc', 'van der Berg')).toBe('jean.luc.van.der.berg');
    expect(localPartFrom('  Zoë ', "O'Neill")).toBe('zoe.o.neill');
  });
  it('falls back to the email name, then "member"', () => {
    expect(localPartFrom(null, null, 'sjoerd.x')).toBe('sjoerd.x');
    expect(localPartFrom('', '', '')).toBe('member');
  });
  it('is never longer than a local part may be', () => {
    expect(localPartFrom('a'.repeat(50), 'b'.repeat(50)).length).toBeLessThanOrEqual(64);
  });
});

describe('validLocalPart — what a member may ask for', () => {
  it('accepts letters, digits, dot, dash, underscore', () => {
    for (const s of ['ann', 'ann.lee', 'ann_lee-2', 'a']) expect(validLocalPart(s), s).toBe(true);
  });
  it('refuses spaces, capitals, edge dots, double dots, other signs', () => {
    for (const s of ['Ann', 'ann lee', '.ann', 'ann.', 'ann..lee', 'ann!', '', 'a'.repeat(65)]) expect(validLocalPart(s), s).toBe(false);
  });
});

describe('the address the worker manages', () => {
  const D = 'example.org';
  it('the domain is the part after @ of the delegation admin', () => {
    expect(googleDomainOf('Admin@Example.org')).toBe('example.org');
    expect(googleDomainOf(null)).toBeNull();
    expect(googleDomainOf('no-at-sign')).toBeNull();
  });
  it('created address first; else the person email IN the domain; else none (waits)', () => {
    expect(managedAddress({ status: 'created', created_address: 'Ann@example.org' }, 'ann@gmail.com', D)).toBe('ann@example.org');
    expect(managedAddress(null, 'Bob@Example.org', D)).toBe('bob@example.org');
    expect(managedAddress(null, 'bob@gmail.com', D)).toBeNull();
    // Requested, or declined, is not an account yet.
    expect(managedAddress({ status: 'requested', created_address: null }, 'bob@gmail.com', D)).toBeNull();
    expect(managedAddress({ status: 'declined', created_address: null }, 'bob@gmail.com', D)).toBeNull();
    // A look-alike domain is not the domain.
    expect(managedAddress(null, 'bob@notexample.org', D)).toBeNull();
  });
});

describe('ownDomainAddress — the member already has the account (2026-10-17)', () => {
  it('their own email on the domain, case-insensitive, lowercased', () => {
    expect(ownDomainAddress('Sjoerd.Luteyn@Soul.com', 'soul.com')).toBe('sjoerd.luteyn@soul.com');
    expect(ownDomainAddress(' ann@soul.com ', 'SOUL.COM')).toBe('ann@soul.com');
  });
  it('another domain, a subdomain, a lookalike, or nothing: no', () => {
    expect(ownDomainAddress('ann@gmail.com', 'soul.com')).toBeNull();
    expect(ownDomainAddress('ann@mail.soul.com', 'soul.com')).toBeNull();
    expect(ownDomainAddress('ann@notsoul.com', 'soul.com')).toBeNull();
    expect(ownDomainAddress('ann@soul.com.evil', 'soul.com')).toBeNull();
    expect(ownDomainAddress('@soul.com', 'soul.com')).toBeNull();
    expect(ownDomainAddress(null, 'soul.com')).toBeNull();
    expect(ownDomainAddress('ann@soul.com', null)).toBeNull();
  });
});
