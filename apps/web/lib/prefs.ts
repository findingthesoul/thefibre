import { cookies } from 'next/headers';
import { type Prefs, type Theme, type SidebarMode } from './prefs-shared';

const THEME_VALUES: ReadonlySet<Theme> = new Set(['light', 'dark', 'system']);
const SIDEBAR_VALUES: ReadonlySet<SidebarMode> = new Set([
  'expanded',
  'collapsed',
  'hover',
]);

export async function readPrefs(): Promise<Prefs> {
  const store = await cookies();
  const t = store.get('thefibre.theme')?.value;
  const s = store.get('thefibre.sidebar')?.value;
  return {
    theme: t && THEME_VALUES.has(t as Theme) ? (t as Theme) : 'system',
    sidebar: s && SIDEBAR_VALUES.has(s as SidebarMode) ? (s as SidebarMode) : 'hover',
  };
}
