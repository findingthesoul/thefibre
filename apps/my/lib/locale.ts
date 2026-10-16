// Which language my.thread is in, for this request (2026-10-16, my.thread in
// six languages).
//
// The RULE is shared — `resolvePortalLocale` in @thefibre/shared: the
// thefibre.locale cookie (this browser's choice), then the person's own
// language (identity_profile.locale, the same row the You page's picker
// writes and every email reads), then the browser's Accept-Language, then
// English. This file keeps only what is app-shaped: where each comes from.
//
// THE PROFILE ARRIVES ON /me/nav, the call the layout already makes, so
// knowing the language costs nothing extra. That field is new: during a
// batch window the web can be newer than the API, and an API that does not
// send it — or a /me/nav that fell back to /me/portal (lib/portal-api.ts) —
// leaves `nav.locale` undefined. That is read as "no choice made", the
// cookie and the browser still decide, and nothing fails (locale.test.ts).
//
// Server components call `pageLocale()`; client components read
// `useLocale()` from the LocaleProvider the layout wraps the app in.

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { resolvePortalLocale, type Locale } from '@thefibre/shared';
import { COOKIE_LOCALE } from '@thefibre/shared/prefs';
import type { PortalNav } from './portal-api';
import { loadFrame } from './session';

/** The pure half: what each source said, already read. */
export function pickLocale(a: {
  cookie?: string | null;
  nav?: Pick<PortalNav, 'locale'> | null;
  acceptLanguage?: string | null;
}): Locale {
  return resolvePortalLocale({
    cookie: a.cookie,
    profile: a.nav?.locale ?? null,
    acceptLanguage: a.acceptLanguage,
  });
}

/** This request's language. Cached, so every server component on the page
 *  asks once between them. */
export const pageLocale = cache(async (): Promise<Locale> => {
  const [store, head] = await Promise.all([cookies(), headers()]);
  let nav: PortalNav | null = null;
  try {
    // The same cached call the layout makes; signed out is null.
    nav = (await loadFrame())?.nav ?? null;
  } catch {
    // A frame that failed is the page's problem to show (error.tsx), not a
    // reason to fail at choosing a language. The browser decides instead.
  }
  return pickLocale({
    cookie: store.get(COOKIE_LOCALE)?.value,
    nav,
    acceptLanguage: head.get('accept-language'),
  });
});
