import { describe, expect, it } from 'vitest';
import { fillMemberPageTags, safeLinkUrl } from './member-page.js';

describe('member page tags', () => {
  it('fills known tags', () => {
    expect(fillMemberPageTags('<p>Hi {first_name}, welcome to {community} ({tier}).</p>', { first_name: 'Marja', community: 'Choir', tier: 'Singer' }))
      .toBe('<p>Hi Marja, welcome to Choir (Singer).</p>');
  });
  it('escapes a value: a name can never inject markup', () => {
    const out = fillMemberPageTags('<p>Hi {first_name}</p><a href="https://x.test/?n={first_name}">x</a>', { first_name: '<script>alert(1)</script>" onmouseover="x' });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot; onmouseover=&quot;x');
  });
  it('leaves an unknown tag as typed, so the admin sees the typo', () => {
    expect(fillMemberPageTags('<p>Hi {frist_name}</p>', { first_name: 'Marja' })).toBe('<p>Hi {frist_name}</p>');
  });
  it('a missing value becomes empty, never the literal tag', () => {
    expect(fillMemberPageTags('<p>{first_name} {last_name}</p>', { first_name: 'Marja', last_name: null })).toBe('<p>Marja </p>');
  });
  it('accepts {name}, the thread-message spelling', () => {
    expect(fillMemberPageTags('Hi {name}', { first_name: 'Marja' })).toBe('Hi Marja');
  });
});

describe('link entries', () => {
  it('accepts http and https', () => {
    expect(safeLinkUrl(' https://docs.google.com/document/d/abc ')).toBe('https://docs.google.com/document/d/abc');
    expect(safeLinkUrl('http://example.org')).toBe('http://example.org/');
  });
  it('refuses javascript:, data: and anything that is not a web address', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'docs.google.com/x', '', null, 42, 'https://' + 'a'.repeat(2001)]) {
      expect(safeLinkUrl(bad), String(bad).slice(0, 40)).toBeNull();
    }
  });
});
