import { describe, expect, it } from 'vitest';
import {
  DISCOUNT_CODE_ALPHABET,
  generateDiscountCode,
} from './discount-code-generate';

describe('a generated discount code', () => {
  it('looks like K7QX-29MB', () => {
    expect(generateDiscountCode()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('never contains a character that gets mistyped', () => {
    // THE POINT OF THE ALPHABET. A code is read off a screen or a slide and
    // typed back in, and a mistyped code is indistinguishable from an invalid
    // one — the person is just told no. 1000 codes is enough that a stray
    // character would show up.
    const banned = /[ILO01]/;
    for (let i = 0; i < 1000; i += 1) {
      const code = generateDiscountCode();
      expect(banned.test(code), `${code} contains a look-alike`).toBe(false);
    }
    // And the alphabet itself says so, so this cannot pass because the
    // generator stopped producing letters.
    expect(DISCOUNT_CODE_ALPHABET).not.toMatch(banned);
    expect(DISCOUNT_CODE_ALPHABET.length).toBe(31);
  });

  it('uses every character of its alphabet, given enough codes', () => {
    // The positive anchor for the case above: a generator emitting only 'A'
    // would pass "no look-alikes" perfectly.
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      for (const ch of generateDiscountCode().replace('-', '')) seen.add(ch);
    }
    expect(seen.size, [...seen].sort().join('')).toBe(DISCOUNT_CODE_ALPHABET.length);
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateDiscountCode()));
    expect(codes.size).toBe(500);
  });

  it('discards biased bytes rather than taking them modulo', () => {
    // 31 does not divide 256, so `byte % 31` would favour the first few
    // letters. Bytes at or above 248 (the last multiple of 31) must be
    // skipped. Feeding only such bytes followed by zeros proves the skip
    // happens: if it did not, the code would be built from 248..255 and the
    // first character would not be 'A'.
    const scripted: number[] = [250, 251, 252, 253, 254, 255, 248, 249];
    let i = 0;
    const bytes = (n: number) =>
      Uint8Array.from({ length: n }, () => (i < scripted.length ? scripted[i++]! : 0));
    // Every usable byte is 0 → 'A' throughout.
    expect(generateDiscountCode(bytes)).toBe('AAAA-AAAA');
  });

  it('maps bytes to the alphabet in order', () => {
    const bytes = (n: number) => Uint8Array.from({ length: n }, (_, k) => k % 31);
    // 0,1,2,3 then 4,5,6,7 → the first eight letters of the alphabet.
    expect(generateDiscountCode(bytes)).toBe(
      `${DISCOUNT_CODE_ALPHABET.slice(0, 4)}-${DISCOUNT_CODE_ALPHABET.slice(4, 8)}`,
    );
  });

  it('refuses to invent a code without a secure source', () => {
    // A code from a predictable source looks exactly like a good one, so the
    // only honest behaviour is to fail. Asserted by taking crypto away.
    const real = (globalThis as { crypto?: Crypto }).crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      expect(() => generateDiscountCode()).toThrow(/secure random/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
    }
  });
});
