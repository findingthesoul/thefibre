// Constants + types safe to import from both server and client components.
// (lib/prefs.ts is server-only — uses next/headers.) The cross-app pieces
// live in @thefibre/shared/prefs (extraction phase 3). Connections has no
// cookies of its own.

export {
  COOKIE_THEME,
  COOKIE_SIDEBAR,
  COOKIE_INTRO,
  type Theme,
  type SidebarMode,
  type IntroMode,
  type Prefs,
  COOKIE_TODO,
  type TodoMode,
} from '@thefibre/shared/prefs';
