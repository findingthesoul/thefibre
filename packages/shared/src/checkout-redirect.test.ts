import { describe, expect, it } from 'vitest';
import { redirectToCheckout } from './checkout-redirect.js';

/** A window stand-in: `top` is what decides which branch runs. */
function fakeWindow(opts: { framed: boolean; topThrows?: boolean }) {
  const self = { location: { href: '' } } as unknown as Window;
  const top = {
    get location() {
      if (opts.topThrows) throw new Error('SecurityError');
      return topLocation;
    },
  } as unknown as Window;
  const topLocation = { href: '' };
  Object.assign(self, { self, top: opts.framed ? top : self });
  return { win: self as Window, topLocation };
}

describe('redirectToCheckout', () => {
  it('navigates this window when not embedded', () => {
    const { win } = fakeWindow({ framed: false });
    redirectToCheckout('https://checkout.stripe.com/x', win);
    expect(win.location.href).toBe('https://checkout.stripe.com/x');
  });

  it('escapes to the top window when embedded', () => {
    // The case that matters: Stripe refuses to be framed, so staying inside
    // the embed shows the visitor a blank widget.
    const { win, topLocation } = fakeWindow({ framed: true });
    redirectToCheckout('https://checkout.stripe.com/x', win);
    expect(topLocation.href).toBe('https://checkout.stripe.com/x');
    expect(win.location.href).toBe('');
  });

  it('falls back to this window when the frame is sandboxed', () => {
    const { win } = fakeWindow({ framed: true, topThrows: true });
    redirectToCheckout('https://checkout.stripe.com/x', win);
    expect(win.location.href).toBe('https://checkout.stripe.com/x');
  });
});
