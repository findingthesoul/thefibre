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
// Pulse: which Cashflow view the user last chose (period is the default).
export const COOKIE_CASHFLOW_VIEW = 'thefibre.pulse.cashflow-view';
// Pulse: fit the by-period grid to the viewport ('on') vs scrollable ('off').
export const COOKIE_CASHFLOW_FIT = 'thefibre.pulse.cashflow-fit';
