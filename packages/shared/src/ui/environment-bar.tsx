// A 5px blue line along the top of everything that is not production.
//
// Sjoerd, 2026-10-04: *"place a 5px blue bar at the top of staging - to make
// it distinct from production."*
//
// The problem it solves is that staging is a perfect copy. Same design, same
// data shapes, same flows — so the only thing distinguishing it from the real
// product is a domain in the address bar, which nobody reads while
// concentrating. The cost of that confusion is not hypothetical here: a demo
// given from the wrong stack, a bug reported against data that does not
// exist, a "that's broken" about something fixed hours ago on the other one.
//
// WHICH ENVIRONMENT, decided honestly
// ───────────────────────────────────
// Not from the hostname. A hostname check is a second, drifting definition of
// "staging" that a new domain silently breaks, and `isStagingHost` already
// exists in branding for the narrow job of routing. This asks the deployment
// what it is: `isProductionDeployment(process.env.VERCEL_ENV)`, the same
// single source `robots.ts` has used since 2026-09-09.
//
// The asymmetry is the opposite of the robots one, and deliberately so.
// There, "unknown" must mean "do not index", because an un-indexed production
// site is lost revenue. Here the expensive mistake is a bar on PRODUCTION —
// it would make the real product look broken — and the cheap mistake is a bar
// somewhere extra. Production always has `VERCEL_ENV=production`, so anything
// else, including a local dev server and a preview build, shows the line. A
// local dev server is also not production, and that is worth seeing.
//
// PUSH OR OVERLAY
// ───────────────
// Overlay — `fixed`, 5px, `pointer-events-none`. Pushing the page down by 5px
// would mean every full-height layout in nine apps is 5px short on staging,
// which makes staging a slightly different product to test on: `h-dvh` shells,
// sticky headers and bottom tab bars would each sit 5px off, and a layout bug
// found there would not reproduce in production. An overlay changes nothing
// about the page beneath it. The cost is that it covers the topmost 5px of
// the page, which in every app is chrome padding, not content — checked
// against the shells before choosing.
//
// It carries no text. At 5px there is no room for any, and the bar is for
// peripheral vision — you should know which stack you are on without reading.
// The accessible name does the work for anyone not seeing it.

import { isProductionDeployment } from '../robots.js';

/** Does this deployment get the bar? Exported as a function rather than
 *  inlined in the component because @thefibre/shared has no react-dom and
 *  therefore cannot render anything in a test — and a bar whose SHOWING is
 *  untested is the one way this feature can do harm (a blue line across
 *  production). The decision is the part worth asserting; the div is not. */
export function showsEnvironmentBar(vercelEnv: string | undefined): boolean {
  return !isProductionDeployment(vercelEnv);
}

/** The bar's classes, in one place so the test can assert the things that
 *  are easy to break silently: its height, that it is pinned, that it cannot
 *  swallow a click, and that its colour is a token rather than a typed
 *  value. */
export const ENVIRONMENT_BAR_CLASS =
  'fixed inset-x-0 top-0 z-[9999] h-[5px] bg-staging pointer-events-none';

/**
 * @param vercelEnv `process.env.VERCEL_ENV`, passed in by the app — this
 *   package is bundled into browser builds and reads no environment of its
 *   own (the same split robots.ts uses: shared decides WHAT, the caller
 *   supplies the fact).
 */
export function EnvironmentBar({ vercelEnv }: { vercelEnv: string | undefined }) {
  if (!showsEnvironmentBar(vercelEnv)) return null;
  return (
    <div
      // A stable hook so a surface that must not show it can say so —
      // Thread's embeds do, see apps/thread/app/embed/layout.tsx.
      data-environment-bar=""
      role="note"
      aria-label="Staging"
      title="Staging — not the real thing"
      className={ENVIRONMENT_BAR_CLASS}
    />
  );
}
