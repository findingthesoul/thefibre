// Constants + types safe to import from both server and client components.
// (lib/prefs.ts is server-only — uses next/headers.) The cross-app pieces
// live in @thefibre/shared/prefs (extraction phase 3). Connections has no
// cookies of its own.

export {
  COOKIE_THEME,
  COOKIE_SIDEBAR,
  type Theme,
  type SidebarMode,
  type Prefs,
} from '@thefibre/shared/prefs';
