// Where Stripe sends a buyer back after a /public/buy or /public/subscribe
// checkout. By default the community's own page (as since 2026-09-06). A
// purchase started in my.thread's Shop asks for my.thread instead
// (2026-10-17) — by NAMING it, never by passing a URL: the only accepted
// value is the token 'my', and the address is this stack's own my.thread
// origin, so nobody can point a checkout's return at another site.

import { z } from 'zod';

export const ReturnTo = z.enum(['my']).optional();
export type ReturnTarget = z.infer<typeof ReturnTo>;

export function checkoutReturn(
  returnTo: ReturnTarget,
  where: { communityBase: string; myOrigin: string; lang: string },
): { success: string; cancel: string } {
  if (returnTo === 'my') {
    return { success: `${where.myOrigin}/purchases?paid=1&session_id={CHECKOUT_SESSION_ID}`, cancel: `${where.myOrigin}/shop?cancelled=1` };
  }
  return {
    success: `${where.communityBase}/purchased?session_id={CHECKOUT_SESSION_ID}&lang=${where.lang}`,
    cancel: `${where.communityBase}?cancelled=1&lang=${where.lang}`,
  };
}
