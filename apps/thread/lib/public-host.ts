import { appUrl } from '@thefibre/shared';

// The Thread's own public address, ONE place (2026-09-14: fifteen files each
// re-derived it from NEXT_PUBLIC_THREAD_URL with their own fallback string).
// Derived from the same env override the links themselves use, so staging
// shows staging URLs. NEXT_PUBLIC_* is inlined at build time, which makes
// this safe in client components too — but only when the property is
// accessed statically, hence the literal read and no dynamic key.
// No server-only imports here: client components import this file.

/** Origin with protocol, e.g. `https://app.thethread.app` — for hrefs and script tags. */
export const THREAD_ORIGIN = appUrl('the-thread', {
  NEXT_PUBLIC_THREAD_URL: process.env.NEXT_PUBLIC_THREAD_URL,
}).replace(/\/$/, '');

/** Bare host, e.g. `app.thethread.app` — the prefix shown next to slug inputs. */
export const THREAD_HOST = new URL(THREAD_ORIGIN).host;
