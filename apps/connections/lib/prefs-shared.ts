// Constants + types safe to import from both server and client components.
// (lib/prefs.ts is server-only — uses next/headers.) The cross-app pieces
// live in @thefibre/shared/prefs (extraction phase 3); Pulse keeps its own
// cashflow cookies here.

export {
  COOKIE_THEME,
  COOKIE_SIDEBAR,
  type Theme,
  type SidebarMode,
  type Prefs,
} from '@thefibre/shared/prefs';

// Pulse: which Cashflow view the user last chose (period is the default).
export const COOKIE_CASHFLOW_VIEW = 'thefibre.pulse.cashflow-view';
// Pulse: fit the by-period grid to the viewport ('on') vs scrollable ('off').
export const COOKIE_CASHFLOW_FIT = 'thefibre.pulse.cashflow-fit';
// Pulse: last Me/Team/Workspace scope on Cashflow ('me' | 'team:<id>' |
// 'workspace') — the default when the URL carries no ?scope/?team params.
export const COOKIE_CASHFLOW_SCOPE = 'thefibre.pulse.cashflow-scope';
