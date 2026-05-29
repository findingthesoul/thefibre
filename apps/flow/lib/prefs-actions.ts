'use server';

// Server Action for persisting UI preferences (theme, sidebar mode).
//
// Why server-side: Safari's ITP caps ALL cookies set via document.cookie
// (client-side JS) to a 7-day lifetime, regardless of the max-age requested.
// Cookies written from the server via Set-Cookie are not subject to that cap,
// so preferences actually persist "throughout sessions".
//
// No `domain` is set → the cookie is host-only → each app
// (thefibre.app / meet.thefibre.app / flow.thefibre.app) keeps its own
// preference. That's the desired per-app behaviour.
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
  store.set(name, value, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
}
