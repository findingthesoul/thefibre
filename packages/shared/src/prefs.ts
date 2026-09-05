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
