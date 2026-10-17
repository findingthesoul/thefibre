// The renewal reminder for a member with no card asks for one before the
// date, with the Purchases link, in every locale — and never says "nothing
// to do". With a card it keeps the old wording.

import { describe, expect, it } from 'vitest';
import { membershipRenewalReminder } from './membership-templates.js';

const URL = 'https://my.thethread.app/purchases';
const base = { name: 'Marja', communityName: 'soul.com', tierName: 'Member', renewsAt: '2027-01-01T00:00:00Z', amountCents: 50000, currency: 'EUR' };
const NOTHING = /Nothing to do|niets te doen|No tienes que hacer|não precisa fazer|musst du nichts tun|Rien à faire/;

describe('renewal reminder without a card', () => {
  for (const locale of ['en', 'nl', 'es', 'pt', 'de', 'fr']) {
    it(`asks for a card before the date (${locale})`, () => {
      const r = membershipRenewalReminder({ ...base, locale, needsCard: true, purchasesUrl: URL });
      expect(r.text).toContain(URL);
      expect(r.html).toContain(`href="${URL}"`);
      expect(r.text).toMatch(/2027/);
      expect(r.text).not.toMatch(NOTHING);
      expect(r.html).not.toMatch(NOTHING);
    });
  }
  it('with a card: "nothing to do", no Purchases link', () => {
    const r = membershipRenewalReminder({ ...base, locale: 'en', needsCard: false, purchasesUrl: URL });
    expect(r.text).toMatch(NOTHING);
    expect(r.text).not.toContain(URL);
  });
  it('a member name with markup is still escaped', () => {
    const r = membershipRenewalReminder({ ...base, name: '<b>x</b>', locale: 'en', needsCard: true, purchasesUrl: URL });
    expect(r.html).not.toContain('<b>x</b>');
  });
});
