import { cookies } from 'next/headers';
import { type Prefs, type Theme, type SidebarMode, type IntroMode } from './prefs-shared';

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
  // Read server-side so a page that has had its intro switched off never
  // renders it and takes it away again a frame later.
  const i = store.get('thefibre.intro')?.value;
  return {
    theme: t && THEME_VALUES.has(t as Theme) ? (t as Theme) : 'system',
    sidebar: s && SIDEBAR_VALUES.has(s as SidebarMode) ? (s as SidebarMode) : 'hover',
    intro: i === 'off' ? ('off' as IntroMode) : ('on' as IntroMode),
  };
}
