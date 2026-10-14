import { describe, expect, it } from 'vitest';
import { portalPathFor } from './portal-path';

// Where an old `/my/...` address lands in the portal. Worth a test rather
// than a reading, because the only other way to check it is to follow a
// redirect on a deployed app — and the cost of getting it wrong is a member
// looking at the wrong page after clicking a link from an email.

describe('an old /my address', () => {
  it('sends an invoice link to Purchases', () => {
    // "Invoices" became "Purchases" in the portal. Honour the rename rather
    // than paper over it.
    expect(portalPathFor(['invoices'])).toBe('/purchases');
    expect(portalPathFor(['invoices', 'abc-123'])).toBe('/purchases');
    expect(portalPathFor(['invoices', 'abc-123', 'pdf'])).toBe('/purchases');
  });

  it('sends everything else to Memberships', () => {
    for (const rest of [[], ['anything'], ['a', 'b', 'c'], ['settings']]) {
      expect(portalPathFor(rest), JSON.stringify(rest)).toBe('/memberships');
    }
  });

  it('does NOT try to carry an invoice id across', () => {
    // The ids are not the same ids. Landing somebody on a stranger's purchase
    // would be worse than landing them on the list holding their own.
    expect(portalPathFor(['invoices', 'abc-123'])).not.toContain('abc-123');
  });
});
