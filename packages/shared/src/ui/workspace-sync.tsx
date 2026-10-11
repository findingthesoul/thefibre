'use client';

// Ends the disagreement between the workspace this app's token is acting in
// and the one the person last chose.
//
// Sjoerd: *"Apps remember their own workspace. It swaps back."* The workspace
// lives in the access token, and production has two cookie domains —
// thefibre.app for the platform, thethread.app for the delivery apps — so
// those are two independent sessions. Switch workspace in one, open the
// other, and the second is still carrying the workspace its token was minted
// with, for up to an hour. Nothing was lost in transit: the token is simply
// old.
//
// `POST /auth/workspace` has always recorded the choice, and the access-token
// hook has always preferred it, so **refreshing the session is the entire
// fix** — it re-runs the hook, which stamps the chosen workspace. The API
// already returned both halves so that a client could "notice the
// disagreement and end it" (routes/auth.ts). `loadAppShell` already computed
// `staleWorkspace`. Until 2026-10-11 nothing read it. This is the reader.
//
// It renders nothing. Three guards, each for a failure that is worse than the
// staleness it fixes:
//
//   1. **has_app**, applied upstream in loadAppShell: the hook stamps the
//      chosen workspace whatever app is asking, so refreshing into a
//      workspace where this person holds no seat for THIS app would bounce
//      them straight back out of the app they just opened.
//   2. **Once per mount.** A refresh that does not change the token must not
//      trigger another one. The ref is checked and set before the await, so a
//      re-render while the first call is in flight cannot start a second.
//   3. **Mount only, never mid-edit.** This fires on mount and on navigation,
//      not on a timer and not on focus, so it cannot call `router.refresh()`
//      underneath somebody who is halfway through typing into a form that is
//      already open. A page that is open stays as it is.
//
// Failure is silent on purpose: if the refresh does not work, the app carries
// on in the workspace it was already showing, which is exactly today's
// behaviour. There is nothing here for a person to act on.

import { useEffect, useRef } from 'react';

export function WorkspaceSync({
  stale,
  refreshSession,
  onRefreshed,
}: {
  /** `staleWorkspace` from loadAppShell — already gated on has_app. */
  stale: boolean;
  /** The app's browser Supabase: re-mints the token through the hook. */
  refreshSession: () => Promise<unknown>;
  /** Re-render with the new token — the app's own router.refresh(). */
  onRefreshed: () => void;
}) {
  const done = useRef(false);

  useEffect(() => {
    if (!stale || done.current) return;
    // Set BEFORE the await: a re-render during the in-flight call must not
    // start a second refresh.
    done.current = true;
    let cancelled = false;
    void (async () => {
      try {
        await refreshSession();
      } catch {
        // Carry on in the workspace already on screen — today's behaviour.
        return;
      }
      if (!cancelled) onRefreshed();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  return null;
}
