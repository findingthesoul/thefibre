import { cookies } from 'next/headers';
import { COOKIE_THEME, COOKIE_SIDEBAR, type Prefs, type Theme, type SidebarMode } from './prefs-shared';

const THEME_VALUES: ReadonlySet<Theme> = new Set(['light', 'dark', 'system']);
const SIDEBAR_VALUES: ReadonlySet<SidebarMode> = new Set([
  'expanded',
  'collapsed',
  'hover',
]);

export async function readPrefs(): Promise<Prefs> {
  const store = await cookies();
  const t = store.get(COOKIE_THEME)?.value;
  const s = store.get(COOKIE_SIDEBAR)?.value;
  return {
    theme: t && THEME_VALUES.has(t as Theme) ? (t as Theme) : 'system',
    sidebar: s && SIDEBAR_VALUES.has(s as SidebarMode) ? (s as SidebarMode) : 'hover',
  };
}
