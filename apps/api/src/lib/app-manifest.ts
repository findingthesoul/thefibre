// Reading an app's declared manifest (`fibre.app.json`, stored on `app.manifest`).
//
// Before docs/brief-external-apps.md the manifest was informational: an app
// declared its scopes and its activity types, and nothing checked either. A
// typo'd activity type landed silently on a workspace timeline. These readers
// are what makes the declaration load-bearing.

import { isAppScope, type AppScope } from './app-keys.js';

function asObject(manifest: unknown): Record<string, unknown> | null {
  return manifest && typeof manifest === 'object' && !Array.isArray(manifest)
    ? (manifest as Record<string, unknown>)
    : null;
}

/** Scopes the app's manifest asked for, or null if it declared none. */
export function readManifestScopes(manifest: unknown): AppScope[] | null {
  const m = asObject(manifest);
  if (!m || !Array.isArray(m.scopes_requested)) return null;
  const scopes = m.scopes_requested
    .filter((s): s is string => typeof s === 'string')
    .filter(isAppScope);
  return scopes.length ? [...new Set(scopes)] : null;
}

/**
 * Activity types the app declared, accepting both manifest spellings —
 * `["thing_happened"]` and `[{ "type": "thing_happened", "subject": "…" }]`.
 *
 * `null` means "declared none", and the caller falls back to accepting any
 * snake_case type. Every first-party app relies on that fallback: they ship no
 * manifest, and retrofitting one for each is a separate job from opening the
 * platform to outside apps.
 */
export function readManifestActivityTypes(manifest: unknown): string[] | null {
  const m = asObject(manifest);
  if (!m || !Array.isArray(m.activity_types) || m.activity_types.length === 0) return null;
  const types = m.activity_types
    .map((t) => (typeof t === 'string' ? t : asObject(t)?.type))
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
  return types.length ? [...new Set(types)] : null;
}

/** Scopes an app asked for after it was approved, waiting for a platform
 *  admin (stored beside `scopes_requested` on the manifest). */
export function readPendingScopes(manifest: unknown): AppScope[] {
  const m = asObject(manifest);
  if (!m || !Array.isArray(m.scopes_pending_review)) return [];
  return [...new Set(m.scopes_pending_review.filter((s): s is string => typeof s === 'string').filter(isAppScope))];
}

/**
 * What a manifest PUT may do to the scopes a key is capped by.
 *
 * The cap (`scopes_requested`) is what a platform admin approved at review.
 * After approval, asking for MORE does not raise it: the extra scopes wait in
 * `scopes_pending_review` until a platform admin approves them on
 * /admin/apps. Asking for the same or fewer applies at once. Before review,
 * and for the reviewer, the request is the cap.
 *
 * `approved === null` is an app that declared no scopes: keys are not capped
 * at all, so any declared list narrows them and applies at once.
 */
export function settleRequestedScopes(opts: {
  approved: readonly string[] | null;
  requested: readonly string[];
  reviewed: boolean;
  byReviewer: boolean;
}): { scopes_requested: string[]; scopes_pending_review: string[] } {
  const requested = [...new Set(opts.requested.filter(isAppScope))];
  if (!opts.reviewed || opts.byReviewer || opts.approved === null) {
    return { scopes_requested: requested, scopes_pending_review: [] };
  }
  const approved = new Set(opts.approved);
  return {
    scopes_requested: requested.filter((s) => approved.has(s)),
    scopes_pending_review: requested.filter((s) => !approved.has(s)),
  };
}

/** Two declarations that say the same thing, in any order. */
export function sameSet(a: readonly string[] | null, b: readonly string[] | null): boolean {
  const x = new Set(a ?? []);
  const y = new Set(b ?? []);
  return x.size === y.size && [...x].every((v) => y.has(v));
}
