// A community's SIGNATURE on its transactional member emails (Sjoerd 2ix):
// sanitised to a sign-off (bold, italic, links), picked like the welcome
// (member's language → page language → none), and placed as the LAST block
// of the body — after every fact, above our footer — in all five emails.
// card-changed is in the P4 path, dark until the publishable key, so this is
// the only thing proving its placement until a live send exists.

import { describe, expect, it } from 'vitest';
import {
  membershipCardChanged,
  membershipLapsed,
  membershipPaymentFailed,
  membershipRenewalChanged,
  membershipRenewalReminder,
} from './membership-templates.js';
import { sanitizeSignature } from '../rich-text.js';
import { pickTemplate, type TemplateRow } from '../member-email-templates.js';

const SIG = '<p>Warmly, <strong>the choir</strong> · <a href="https://choir.example">choir.example</a></p>';

describe('sanitizeSignature: a sign-off, nothing more', () => {
  it('keeps bold, italic, links and lines', () => {
    expect(sanitizeSignature(SIG)).toBe(SIG);
    expect(sanitizeSignature('<p><em>Anna</em><br>Board</p>')).toBe('<p><em>Anna</em><br>Board</p>');
    expect(sanitizeSignature('<a href="mailto:hi@choir.example">mail us</a>')).toContain('href="mailto:hi@choir.example"');
  });
  it('drops headings, images, scripts, styles and unsafe links — keeping the words', () => {
    const out = sanitizeSignature('<h1>Big</h1><img src="x" onerror="alert(1)"><script>alert(1)</script><p style="color:red">Hi</p><a href="javascript:alert(1)">x</a>')!;
    expect(out).not.toMatch(/<h1|<img|<script|style=|javascript:/);
    expect(out).toContain('Big');
    expect(out).toContain('Hi');
  });
  it('empty once cleaned is null', () => {
    expect(sanitizeSignature('<p><br></p>')).toBeNull();
    expect(sanitizeSignature(null)).toBeNull();
  });
});

describe('which signature row', () => {
  const row = (locale: 'en' | 'nl', intro: string): TemplateRow => ({ id: locale, kind: 'signature', tier_id: null, locale, subject: null, image_path: null, image_alt: null, intro_html: intro, closing: null });
  const rows = [row('nl', 'NL'), row('en', 'EN')];
  it('the member’s language first, then the page language, then none', () => {
    expect(pickTemplate(rows, 'signature', null, 'en', 'nl')?.intro_html).toBe('EN');
    expect(pickTemplate(rows, 'signature', null, 'fr', 'nl')?.intro_html).toBe('NL');
    expect(pickTemplate([row('nl', 'NL')], 'signature', null, 'fr', 'de')).toBeNull();
  });
});

const base = { name: 'Marja', communityName: 'The Choir', tierName: 'Singer', locale: 'en' as const };
const emails: [string, (sig: string | null) => { html: string; text: string }][] = [
  ['renewal reminder', (s) => membershipRenewalReminder({ ...base, renewsAt: '2027-01-01T00:00:00Z', amountCents: 3000, currency: 'EUR', signatureHtml: s })],
  ['payment failed', (s) => membershipPaymentFailed({ ...base, signatureHtml: s })],
  ['lapsed', (s) => membershipLapsed({ ...base, joinUrl: 'https://join.example/choir', signatureHtml: s })],
  ['renewal stopped', (s) => membershipRenewalChanged({ ...base, stopped: true, until: '31 December 2026', signatureHtml: s })],
  ['card changed (P4, dark)', (s) => membershipCardChanged({ ...base, brand: 'visa', last4: '4242', signatureHtml: s })],
];

describe.each(emails)('%s', (_name, render) => {
  it('signed: the sign-off is the last thing in the body, after the facts and above our footer', () => {
    const { html, text } = render(SIG);
    const at = html.indexOf('Warmly, <strong>the choir</strong>');
    expect(at).toBeGreaterThan(html.indexOf('Hi Marja'));
    // Every fact paragraph comes before it…
    expect(html.lastIndexOf('The Choir', at)).toBeGreaterThan(-1);
    // …and our footer after it.
    expect(html.indexOf('>Help</a>')).toBeGreaterThan(at);
    expect(html.indexOf('>About us</a>')).toBeGreaterThan(at);
    // Plain text: the words, tags out, at the end.
    expect(text.trimEnd().endsWith('Warmly, the choir · choir.example')).toBe(true);
    expect(text).not.toContain('<strong>');
  });
  it('unsigned: exactly today’s email', () => {
    const none = render(null);
    expect(none.html).not.toContain('Warmly');
    expect(render('')).toEqual(none);
  });
});
