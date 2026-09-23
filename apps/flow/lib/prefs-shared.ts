// Constants + types safe to import from both server and client components.
// (lib/prefs.ts is server-only — uses next/headers.) The implementation
// lives in @thefibre/shared/prefs (extraction phase 3).

export {
  COOKIE_THEME,
  COOKIE_SIDEBAR,
  type Theme,
  type SidebarMode,
  type Prefs,
  COOKIE_TODO,
  type TodoMode,
} from '@thefibre/shared/prefs';
