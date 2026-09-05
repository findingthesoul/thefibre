// Constants + types safe to import from both server and client components.
// (lib/prefs.ts is server-only — uses next/headers.) The implementation
// lives in @thefibre/shared/prefs (extraction phase 3).

export {
  COOKIE_THEME,
  COOKIE_SIDEBAR,
  type Theme,
  type SidebarMode,
  type Prefs,
} from '@thefibre/shared/prefs';

// UI language (i18n P2, D1) — one user-level setting, domain-wide like the
// theme. The durable copy is identity_profile.locale (via /api/v1/profile);
// the cookie exists so every app can read it before any API round-trip.
// Value is one of the shared LOCALES; '' / absent = no preference.
export const COOKIE_LOCALE = 'thefibre.locale';
