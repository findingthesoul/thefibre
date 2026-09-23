// Cross-app preference constants + types, safe to import from both server
// and client components (the per-app lib/prefs.ts stays server-only — it
// uses next/headers). Extraction phase 3: the six identical lib/prefs-shared
// copies now re-export from here; pulse keeps its extra cashflow cookies in
// its local file alongside the re-export.

export type Theme = 'light' | 'dark' | 'system';
export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

export type Prefs = {
  theme: Theme;
  sidebar: SidebarMode;
  /** Whether a page's explanatory intro is shown. OPTIONAL, and absent means
   *  'on': the other eight apps' readPrefs do not set it, and this type is
   *  additive on purpose so adopting the toggle stays a per-app decision. */
  intro?: IntroMode;
  /** Whether the To do panel is open. OPTIONAL and additive, like `intro`.
   *  Sjoerd, 2026-09-23: *"the panel can also stay open, scanning through
   *  various apps"* — so it is a cookie, not component state, and the topbar
   *  renders it open on the server rather than a frame after hydration. */
  todo?: TodoMode;
};

/** 'open' = the panel is showing; absent / anything else = closed. */
export type TodoMode = 'open' | 'closed';

/** Whether the paragraph under a page title is shown. Sjoerd, 2026-09-21,
 *  about Today's: *"should have a toggle button (on and off... reduce info on
 *  interface when not really needed)"*. Off is a real answer and has to
 *  persist, so it is a cookie rather than component state: the text explains
 *  a page the first few times and is furniture for ever after. */
export type IntroMode = 'on' | 'off';

export const COOKIE_THEME = 'thefibre.theme';
export const COOKIE_SIDEBAR = 'thefibre.sidebar';
// Domain-wide like the other two: somebody who does not want the explanation
// on Today does not want it on the landscape either.
export const COOKIE_INTRO = 'thefibre.intro';

// The To do panel's open state. Domain-wide for the same reason as the
// others: a list you left open is a list you are working from, and walking
// into the next app should not close it. Note the reach of "domain-wide" —
// it is ONE apex, so on production the panel's state carries across the
// thethread.app apps but not over to thefibre.app, which is a different
// registrable domain and cannot share a cookie. On staging every app is
// under thefibre.tech, so there it carries everywhere.
export const COOKIE_TODO = 'thefibre.todo';

// UI language (i18n P2, D1) — one user-level setting, domain-wide like the
// theme. The durable copy is identity_profile.locale (via /api/v1/profile);
// the cookie exists so every app can read it before any API round-trip.
// Value is one of the shared LOCALES; '' / absent = no preference. Here
// since 2026-09-14: seven lib/locale.ts copies each declared it themselves.
export const COOKIE_LOCALE = 'thefibre.locale';

/**
 * Write a preference cookie from the browser, immediately.
 *
 * The durable copy is still the server action (`savePref`): Safari's ITP caps
 * anything set via document.cookie to seven days, which is why preferences are
 * written server-side in the first place. This is the belt to that braces, and
 * it exists because of a race with a real cost — the To do panel's open state
 * is read by the NEXT page's server render, and a server action fired on click
 * can still be in flight when you click straight through to another app. The
 * cookie then arrives after the render that needed it, and the panel you left
 * open comes up closed. Writing it here makes the state true the instant you
 * click; the server action follows and gives it a year.
 *
 * `domain` is NEXT_PUBLIC_COOKIE_DOMAIN — absent locally, where a host-only
 * cookie is shared by every localhost app anyway.
 */
export function writePrefCookie(name: string, value: string, domain?: string): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:';
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    domain ? `domain=${domain}` : '',
    'max-age=31536000',
    'samesite=lax',
    secure ? 'secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}
