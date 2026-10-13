// A typed discount code is DATA, not a pattern.
//
// Found on 2026-10-13 and confirmed against the staging database before it was
// fixed: the public enrol form matched a typed code with `.ilike('code', …)`
// and no escaping, so a visitor typing `%` matched whatever single active code
// the thread had — EARLYBIRD, as it happened — and got its percentage
// discount without ever knowing the code. One `%` in a public form, for money.
//
// These tests hold two things: the escaping itself, and the fact that the
// route still passes the typed value through it. The second matters more —
// the helper is useless if a future edit drops the call, and a type cannot
// say "this string was escaped".

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isStorableCode, likeLiteral } from './like-escape.js';

describe('likeLiteral', () => {
  it('neutralises the wildcards', () => {
    expect(likeLiteral('%')).toBe('\\%');
    expect(likeLiteral('_')).toBe('\\_');
    expect(likeLiteral('%%_%')).toBe('\\%\\%\\_\\%');
  });

  // `*` is PostgREST's alias for `%`, which SQL knows nothing about — so the
  // first version of this escaped the SQL metacharacters and left the hole
  // open through the layer we actually call. Measured against staging: `*`,
  // `E*` and `*BIRD` all still matched EARLYBIRD until this was added.
  it('neutralises PostgREST’s own wildcard too', () => {
    expect(likeLiteral('*')).toBe('\\*');
    expect(likeLiteral('E*')).toBe('E\\*');
    expect(likeLiteral('*BIRD')).toBe('\\*BIRD');
  });

  it('escapes the escape character first, or the escapes escape each other', () => {
    expect(likeLiteral('\\')).toBe('\\\\');
    expect(likeLiteral('\\%')).toBe('\\\\\\%');
  });

  it('leaves an ordinary code alone', () => {
    expect(likeLiteral('EARLYBIRD')).toBe('EARLYBIRD');
    expect(likeLiteral('summer-25')).toBe('summer-25');
    expect(likeLiteral('zomer_2026@!')).toBe('zomer\\_2026@!');
  });
});

describe('which codes may be stored', () => {
  // A code containing `*` cannot match itself once `*` is escaped — PostgREST
  // turns `\\*` into a literal percent — so such a code could be created and
  // never redeemed. Refused at the door instead.
  it('refuses the wildcards', () => {
    expect(isStorableCode('50%OFF')).toBe(false);
    expect(isStorableCode('STAR*')).toBe(false);
    expect(isStorableCode('*')).toBe(false);
  });

  it('allows everything else people actually use', () => {
    for (const ok of ['EARLYBIRD', 'summer-25', 'zomer_2026', 'VIP.2026', 'a b']) {
      expect(isStorableCode(ok), ok).toBe(true);
    }
  });
});

describe('the coupon lookup uses it', () => {
  const src = readFileSync(new URL('../routes/thread.ts', import.meta.url), 'utf8');

  it('escapes the typed code before matching', () => {
    expect(src).toContain(".ilike('code', likeLiteral(code.trim()))");
  });

  it('refuses a code that could never match itself', () => {
    expect(src).toContain('.refine(isStorableCode');
  });

  // The whole class, not just the one instance: no handler may hand an
  // unescaped public value to ILIKE again. `%${q}%` searches are deliberate
  // (Connect's own search boxes, in a different file) and are not this.
  it('leaves no unescaped ilike on a typed code anywhere in the route', () => {
    const bare = [...src.matchAll(/\.ilike\('code',\s*([^)]*)\)/g)].map((m) => m[1]);
    expect(bare.length, 'there is a code lookup to check').toBeGreaterThan(0);
    for (const arg of bare) {
      expect(arg, `unescaped: .ilike('code', ${arg})`).toContain('likeLiteral');
    }
  });
});

// The same class, one line away: `_` is legal in an email address and is
// ILIKE's single-character wildcard, so an unescaped match could brand
// somebody's sign-in email with a community they have nothing to do with.
// Nothing is authorised from it — which is why it is a leak and not a bypass.
describe('the sign-in brand lookup escapes the address', () => {
  const src = readFileSync(new URL('../routes/auth-hook.ts', import.meta.url), 'utf8');

  it('matches on the escaped address, not the raw one', () => {
    expect(src).toContain('const lowerLiteral = likeLiteral(lower);');
    const bare = [...src.matchAll(/\.ilike\('email',\s*([^)]*)\)/g)].map((m) => m[1]);
    expect(bare.length, 'there is an email lookup to check').toBeGreaterThan(0);
    for (const arg of bare) {
      expect(arg, `unescaped: .ilike('email', ${arg})`).toContain('lowerLiteral');
    }
  });
});
