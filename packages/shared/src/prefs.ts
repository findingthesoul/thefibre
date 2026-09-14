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
};

export const COOKIE_THEME = 'thefibre.theme';
export const COOKIE_SIDEBAR = 'thefibre.sidebar';

// UI language (i18n P2, D1) — one user-level setting, domain-wide like the
// theme. The durable copy is identity_profile.locale (via /api/v1/profile);
// the cookie exists so every app can read it before any API round-trip.
// Value is one of the shared LOCALES; '' / absent = no preference. Here
// since 2026-09-14: seven lib/locale.ts copies each declared it themselves.
export const COOKIE_LOCALE = 'thefibre.locale';
