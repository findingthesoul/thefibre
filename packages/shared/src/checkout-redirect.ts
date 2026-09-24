// Leaving for Stripe Checkout, from anywhere — including inside an embed.
//
// Stripe Checkout refuses to be framed, so a plain `location.href = url` is
// correct on a public page and broken in an iframe: the embed navigates
// itself, Stripe's frame-ancestors blocks it, and the visitor watches a
// widget go blank. The Thread learned this when its enrol form shipped in
// Webflow and carried the fix inline; Membership's two grids never did, so
// the moment the join page became embeddable they would have taken a
// customer's click and shown them nothing.
//
// Extracted 2026-09-24 so there is one answer instead of three — and because
// the next app to sell something will otherwise write a fourth.

/**
 * Send the browser to a checkout URL, escaping an embed if we are in one.
 *
 * `window.top` is cross-origin, so reading `window.self !== window.top` is
 * allowed but ASSIGNING to `top.location` can still throw when the host page
 * sandboxes the frame without `allow-top-navigation`. The catch is therefore
 * not defensive padding: it is the sandboxed case, and falling back to a
 * same-frame navigation at least surfaces Stripe's own refusal rather than
 * failing silently.
 */
export function redirectToCheckout(
  url: string,
  /** Injectable for tests; defaults to the real window. */
  win: Window = globalThis.window,
): void {
  try {
    if (win.self !== win.top && win.top) {
      win.top.location.href = url;
      return;
    }
  } catch {
    /* sandboxed: fall through to the same-frame navigation */
  }
  win.location.href = url;
}
