// A checkout started in my.thread's Shop comes back to my.thread; anything
// else comes back to the community's page; and no request can name an
// arbitrary return address (2026-10-17).

import { describe, expect, it } from 'vitest';
import { ReturnTo, checkoutReturn } from './checkout-return.js';

const where = { communityBase: 'https://membership.thefibre.tech/soul', myOrigin: 'https://my.thefibre.tech', lang: 'nl' };

describe('checkoutReturn', () => {
  it("'my' returns to my.thread: Purchases on success, the Shop on cancel", () => {
    expect(checkoutReturn('my', where)).toEqual({
      success: 'https://my.thefibre.tech/purchases?paid=1&session_id={CHECKOUT_SESSION_ID}',
      cancel: 'https://my.thefibre.tech/shop?cancelled=1',
    });
  });
  it('no target returns to the community page, as before', () => {
    expect(checkoutReturn(undefined, where)).toEqual({
      success: 'https://membership.thefibre.tech/soul/purchased?session_id={CHECKOUT_SESSION_ID}&lang=nl',
      cancel: 'https://membership.thefibre.tech/soul?cancelled=1&lang=nl',
    });
  });
  it('accepts ONLY the token — a URL or any other value is refused by the schema', () => {
    expect(ReturnTo.safeParse('my').success).toBe(true);
    expect(ReturnTo.safeParse(undefined).success).toBe(true);
    for (const bad of ['https://evil.example/steal', '//evil.example', 'my.thefibre.tech', 'thread', '']) {
      expect(ReturnTo.safeParse(bad).success, bad).toBe(false);
    }
  });
});
