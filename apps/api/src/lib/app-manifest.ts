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
