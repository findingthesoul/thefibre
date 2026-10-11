'use client';

// Ends the disagreement between the workspace this app's token is acting in
// and the one the person last chose.
//
// Sjoerd: *"Apps remember their own workspace. It swaps back."* The workspace
// lives in the access token, and production has two cookie domains —
// thefibre.app for the platform, thethread.app for the delivery apps — so
// those are two independent sessions. Switch workspace in one, open the
// other, and the second is still carrying the workspace its token was minted
// with, for up to an hour. Nothing was lost in transit: the token is old.
//
// `POST /auth/workspace` has always recorded the choice, and the access-token
// hook has always preferred it, so **refreshing the session is the fix** — it
// re-runs the hook, which stamps the chosen workspace. The API already
// returned both halves so a client could "notice the disagreement and end it"
// (routes/auth.ts); `loadAppShell` already computed `staleWorkspace`. Until
// 2026-10-11 nothing read it. This is the reader.

import { useEffect, useRef } from 'react';

const STORE_KEY = 'thefibre.ws-sync.attempted';

/** What a mount should do. Separated from the component because it is the
 *  part with rules worth testing, and there is no DOM test setup here. */
export type SyncPlan = {
  /** Re-mint the token through the access-token hook. */
  refresh: boolean;
  /** Reload the document so the new token is the one rendered. */
  reload: boolean;
};

const NOTHING: SyncPlan = { refresh: false, reload: false };

/**
 * Decide, and FAIL CLOSED on the reload.
 *
 * The dangerous combination is a reload that resolves nothing. Resolving this
 * needs a full document load — a soft refresh races the cookie write, which
 * was measured: the token moved and the page still rendered the old workspace
 * — and a document load remounts everything, resetting any in-memory guard.
 * So if the refresh ever fails to move the token, a reload means reload,
 * remount, same disagreement, reload, **forever, in every app**.
 *
 * The only thing that survives a reload is storage, so the attempted pair is
 * recorded there BEFORE acting. And when storage cannot be written — a
 * private window, blocked site data — there is no guard left at all, so the
 * answer is not "carry on without one". It is: refresh the token anyway,
 * because that is harmless and the next ordinary navigation will pick it up,
 * and **do not reload**. The person's workspace corrects itself one
 * navigation later instead of never, and nobody is trapped in a reload loop.
 *
 * `storage` is injected so the throwing case is testable; pass null when
 * there is none.
 */
export function planWorkspaceSync({
  stale,
  syncKey,
  storage,
}: {
  stale: boolean;
  syncKey: string | null;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
}): SyncPlan {
  if (!stale || !syncKey) return NOTHING;

  let seen: string | null = null;
  try {
    seen = storage ? storage.getItem(STORE_KEY) : null;
  } catch {
    seen = null;
  }
  // Already attempted this exact disagreement and it did not resolve. Leave
  // it alone rather than try forever.
  if (seen === syncKey) return NOTHING;

  let persisted = false;
  try {
    if (storage) {
      storage.setItem(STORE_KEY, syncKey);
      persisted = true;
    }
  } catch {
    persisted = false;
  }

  // No durable guard → refresh, but never reload.
  return { refresh: true, reload: persisted };
}

/**
 * Renders nothing. Runs on mount and navigation only — never a timer, never
 * on focus — so it cannot reload underneath somebody halfway through typing
 * into a form that is already open. A page that is open stays as it is.
 *
 * Failure is silent on purpose: if the refresh does not work the app carries
 * on in the workspace it was already showing, which is today's behaviour.
 * There is nothing here for a person to act on.
 */
export function WorkspaceSync({
  stale,
  syncKey,
  refreshSession,
  onRefreshed,
}: {
  /** `staleWorkspace` from loadAppShell — already gated on has_app, so this
   *  is never true for a workspace this app could not serve. */
  stale: boolean;
  /** `staleWorkspaceKey` from loadAppShell: identifies THIS disagreement. */
  syncKey: string | null;
  /** The app's browser Supabase: re-mints the token through the hook. */
  refreshSession: () => Promise<unknown>;
  /** A FULL document load — see the app bindings for why not a soft refresh. */
  onRefreshed: () => void;
}) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    let store: Pick<Storage, 'getItem' | 'setItem'> | null = null;
    try {
      store = typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
      store = null;
    }
    const plan = planWorkspaceSync({ stale, syncKey, storage: store });
    if (!plan.refresh) return;
    // Set BEFORE the await: a re-render during the in-flight call must not
    // start a second refresh.
    done.current = true;
    let cancelled = false;
    void (async () => {
      try {
        await refreshSession();
      } catch {
        return;
      }
      if (!cancelled && plan.reload) onRefreshed();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, syncKey]);

  return null;
}
