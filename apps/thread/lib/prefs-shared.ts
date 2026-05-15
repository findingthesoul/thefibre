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
