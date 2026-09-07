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

// First-login welcome sequence (2026-09-07): the ONLY stored bit of the
// flow, per the onboarding proposal's rule — everything else is derived
// from identity_profile emptiness. 'done' = finished or skipped.
export const COOKIE_WELCOME = 'thefibre.welcome';

// The entry launcher (2026-09-07): 'off' = don't show the popup at login
// (the checkbox on the popup itself); reset from Settings → Profile. And
// the dashboard's inline "Your apps" section: 'collapsed' folds it.
// Per-browser prefs like theme/sidebar — no durable copy, accepted.
export const COOKIE_LAUNCHER = 'thefibre.launcher';
export const COOKIE_APPS_SECTION = 'thefibre.apps';
