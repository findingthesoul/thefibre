// "See this invoice in My Thread" — the button on every invoice email.
//
// Sjoerd, 2026-10-04: a person should be able to *"see his/her invoice online
// (in my.thread - thus login)"*. The parenthesis is the design, not an aside:
// the link goes to a page that asks who you are, and carries no token of its
// own.
//
// WHY NO TOKEN, written down because a tokenised link is the obvious
// "helpful" improvement and it is the wrong one. An invoice email is
// forwarded to a bookkeeper, quoted in a reply, left in a shared inbox and
// screenshotted. A token in that URL turns every one of those into a
// disclosure of somebody's payment history, to whoever ends up holding the
// link, for as long as it lives. Sign-in costs the recipient one emailed code
// and removes the entire class. A uuid on its own names nothing and opens
// nothing.
//
// THE HOST COMES FROM THE ENVIRONMENT, never from a constant here. A
// hard-coded staging host in a production receipt would send a paying
// customer to a test stack to look at their own invoice, and nothing in the
// product would notice — the kind of wrong that is only ever found by the
// person it happened to. `surfaceUrl` is the same helper the calendar feed
// and the message tokens already use.

import { stackSurfaceUrl } from './stack-urls.js';

/**
 * Where a member reads this invoice.
 *
 * Exported separately from the button so the URL can be asserted on its own:
 * which stack it points at is the part that can be wrong in a way nobody
 * sees, and markup around it would only make that harder to test.
 */
export function invoiceOnlineUrl(
  purchaseId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return `${stackSurfaceUrl('my-portal', env)}/purchases/${purchaseId}`;
}

/**
 * The button, in the same shape as the Pay-online one it sits beside.
 *
 * SECONDARY by design — outlined rather than filled. On an unpaid invoice the
 * Pay button is the thing to press, and two solid buttons of equal weight
 * next to each other make a person stop and choose. This one is for later:
 * the copy somebody looks for weeks afterwards when they need the document
 * again.
 *
 * The label SAYS "sign in" rather than discovering it on arrival. A link that
 * promises an invoice and delivers an auth wall reads as a broken link, and
 * the person who gives up is the person who needed their receipt.
 */
export function invoiceOnlineButtonHtml(
  purchaseId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const url = invoiceOnlineUrl(purchaseId, env);
  return `<p style="margin:16px 0 0;"><a href="${url}" style="display:inline-block;border:1px solid #d4d4d0;color:#171717;font-size:14px;padding:9px 19px;border-radius:8px;text-decoration:none;">See this invoice in My Thread (sign in)</a></p>`;
}
