import { describe, expect, it } from 'vitest';
import { MERGE_TOKENS, fillTokens, listOfNames, tokenChips, tokensFor } from './merge-tokens.js';

const values = {
  first_name: 'Marja', last_name: 'de Vries', full_name: 'Marja de Vries', community: 'soul.com',
  thread: 'Leadership weekend', organiser: 'Sjoerd', facilitator: 'Anna', hosts: 'Anna and Peter',
  date: '4 November 2026', 'my.thread': 'https://my.example.test', tier: 'Singer', next_event: 'Open rehearsal',
};

describe('one registry', () => {
  it('every alias fills exactly what its canonical tag fills, on every surface it is valid on', () => {
    for (const t of MERGE_TOKENS) {
      for (const surface of t.surfaces) {
        for (const alias of t.aliases) {
          expect(fillTokens(`{${alias}}`, values, surface, { html: false }), `${alias} on ${surface}`).toBe(
            fillTokens(`{${t.key}}`, values, surface, { html: false }),
          );
        }
      }
    }
  });
  it('a tag not valid on a surface is left as typed there (the writer sees it)', () => {
    expect(fillTokens('{tier}', values, 'thread_message', { html: false })).toBe('{tier}');
    expect(fillTokens('{facilitator}', values, 'member_page', { html: true })).toBe('{facilitator}');
  });
  it('an unknown tag stays; a missing value is empty', () => {
    expect(fillTokens('{frist_name}', values, 'member_page', { html: true })).toBe('{frist_name}');
    expect(fillTokens('[{last_name}]', { first_name: 'M' }, 'member_page', { html: true })).toBe('[]');
  });
  it('the chips are the surface’s tags, braced', () => {
    expect(tokenChips('member_page')).toEqual(tokensFor('member_page').map((k) => `{${k}}`));
    expect(tokensFor('thread_message')).toContain('facilitator');
    expect(tokensFor('member_page')).toContain('my.thread');
  });
});

describe('escaping', () => {
  it('an HTML surface escapes a <script> name, in text and in an attribute', () => {
    const out = fillTokens('<p>{first_name}</p><a href="?n={first_name}">x</a>', { first_name: '<script>x</script>" onclick="y' }, 'member_page', { html: true });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('" onclick="');
  });
});

describe('{hosts} reads naturally', () => {
  it.each([
    ['en', [], ''],
    ['en', ['Anna'], 'Anna'],
    ['en', ['Anna', 'Peter'], 'Anna and Peter'],
    ['en', ['Anna', 'Peter', 'Joost'], 'Anna, Peter, and Joost'],
    ['nl', ['Anna', 'Peter'], 'Anna en Peter'],
    ['nl', ['Anna', 'Peter', 'Joost'], 'Anna, Peter en Joost'],
  ] as const)('%s %j → %s', (locale, names, expected) => {
    expect(listOfNames(names, locale)).toBe(expected);
  });
});
