import Stripe from 'stripe';

// Lazy-initialised: the SDK constructor throws if no key is set, but the
// API should still boot in environments where Stripe isn't configured yet
// (early dev, CI). Routes that need Stripe check `stripeOrNull()` first
// and return 503 with a clear message when it's null.

let cached: Stripe | null | undefined;

export function stripeOrNull(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Stripe(key, {
    // Pin the API version so a Stripe-side upgrade doesn't silently change
    // our request/response shapes. Update deliberately when needed.
    apiVersion: '2026-04-22.dahlia',
    appInfo: { name: 'Fibre Meet', version: '2.0.0' },
  });
  return cached;
}

