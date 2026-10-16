import { describe, expect, it } from 'vitest';
import { fillTemplate, pickTemplate, type TemplateRow } from './member-email-templates.js';

const row = (o: Partial<TemplateRow>): TemplateRow => ({ id: Math.random().toString(36), kind: 'welcome', tier_id: null, locale: 'en', subject: null, image_path: null, image_alt: null, intro_html: null, closing: null, ...o });

describe('which of a community’s rows an email uses', () => {
  const rows = [
    row({ tier_id: 't1', locale: 'nl', subject: 'tier-nl' }),
    row({ tier_id: 't1', locale: 'en', subject: 'tier-en' }),
    row({ tier_id: null, locale: 'nl', subject: 'default-nl' }),
    row({ tier_id: null, locale: 'de', subject: 'default-de' }),
    row({ kind: 'digest', locale: 'nl', subject: 'digest-nl' }),
  ];
  const pick = (tier: string | null, member: 'en' | 'nl' | 'de' | 'fr', page: 'en' | 'nl' = 'nl', kind: 'welcome' | 'digest' = 'welcome') =>
    pickTemplate(rows, kind, tier, member, page)?.subject ?? null;
  it('the tier’s row in the member’s language first', () => expect(pick('t1', 'en')).toBe('tier-en'));
  it('then the tier’s row in the community’s page language', () => expect(pick('t1', 'fr')).toBe('tier-nl'));
  it('a tier with no row: the default in the member’s language, then the page language', () => {
    expect(pick('t2', 'de')).toBe('default-de');
    expect(pick('t2', 'fr')).toBe('default-nl');
  });
  it('nothing written → null (the standard email)', () => {
    expect(pickTemplate([], 'welcome', 't1', 'en', 'en')).toBeNull();
    expect(pick(null, 'fr', 'en')).toBeNull();
  });
  it('kinds never mix', () => expect(pick(null, 'nl', 'nl', 'digest')).toBe('digest-nl'));
});

describe('filling a row', () => {
  it('fills the member_email tokens; the intro is escaped, unknown tags stay as typed', () => {
    const out = fillTemplate(
      row({ subject: 'Welcome {first_name} to {community}', intro_html: '<p>Hi {first_name}, renews {renews_on} {nope}</p>', closing: 'See you, {tier} team' }),
      { first_name: '<Marja>', community: 'soul.com', renews_on: '1 January 2027', tier: 'Singer' },
    )!;
    expect(out.subject).toBe('Welcome <Marja> to soul.com');
    expect(out.introHtml).toBe('<p>Hi &lt;Marja&gt;, renews 1 January 2027 {nope}</p>');
    expect(out.closing).toBe('See you, Singer team');
  });
  it('no row → null', () => expect(fillTemplate(null, {})).toBeNull());
});
