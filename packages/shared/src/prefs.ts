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
};

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

// UI language (i18n P2, D1) — one user-level setting, domain-wide like the
// theme. The durable copy is identity_profile.locale (via /api/v1/profile);
// the cookie exists so every app can read it before any API round-trip.
// Value is one of the shared LOCALES; '' / absent = no preference. Here
// since 2026-09-14: seven lib/locale.ts copies each declared it themselves.
export const COOKIE_LOCALE = 'thefibre.locale';
