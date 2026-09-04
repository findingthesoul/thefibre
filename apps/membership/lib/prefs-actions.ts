'use server';

// Server Action for persisting UI preferences (theme, sidebar mode).
//
// Why server-side: Safari's ITP caps ALL cookies set via document.cookie
// (client-side JS) to a 7-day lifetime, regardless of the max-age requested.
// Cookies written from the server via Set-Cookie are not subject to that cap,
// so preferences actually persist "throughout sessions".
//
// `domain` is set to NEXT_PUBLIC_COOKIE_DOMAIN (`.thefibre.app`) so ONE
// preference follows the user across every app — thefibre.app, meet.,
// thread., flow. (Sjoerd 2026-07-01: settings are per-user, not per-app;
// this reverses the earlier host-only decision.) Locally the env var is
// unset → host-only cookie, which localhost apps share anyway (cookies
// ignore ports).
//
// Not httpOnly: the no-flash ThemeScript in <head> reads the cookie via
// document.cookie before first paint, so it must be JS-readable.

import { cookies } from 'next/headers';
import { COOKIE_THEME, COOKIE_SIDEBAR } from './prefs-shared';

const ONE_YEAR = 60 * 60 * 24 * 365;
const ALLOWED = new Set<string>([COOKIE_THEME, COOKIE_SIDEBAR]);

export async function savePref(name: string, value: string) {
  if (!ALLOWED.has(name)) return; // ignore anything unexpected
  const store = await cookies();
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;
  if (domain) {
    // Evict the legacy host-only cookie so it can't shadow the shared one.
    store.set(name, '', { path: '/', maxAge: 0 });
  }
  store.set(name, value, {
    path: '/',
    ...(domain ? { domain } : {}),
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
}
