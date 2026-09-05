// Constants + types safe to import from both server and client components.
// (lib/prefs.ts is server-only — uses next/headers.)

export type Theme = 'light' | 'dark' | 'system';
export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

export type Prefs = {
  theme: Theme;
  sidebar: SidebarMode;
};

export const COOKIE_THEME = 'thefibre.theme';
export const COOKIE_SIDEBAR = 'thefibre.sidebar';
// UI language (i18n P2, D1) — one user-level setting, domain-wide like the
// theme. The durable copy is identity_profile.locale (via /api/v1/profile);
// the cookie exists so every app can read it before any API round-trip.
// Value is one of the shared LOCALES; '' / absent = no preference.
export const COOKIE_LOCALE = 'thefibre.locale';
