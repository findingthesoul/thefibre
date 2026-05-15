import { UserMenu } from './user-menu';
import { AppSwitcher, type AppEntry } from './app-switcher';
import type { Prefs } from '@/lib/prefs-shared';

export function Topbar({
  email,
  fullName,
  prefs,
  current,
  apps,
}: {
  email: string;
  fullName: string;
  prefs: Prefs;
  current: { slug: string; name: string };
  apps: AppEntry[];
}) {
  const initials =
    (fullName || email)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '·';

  return (
    <header className="h-14 shrink-0 border-b border-line flex items-center justify-between px-4 bg-surface">
      <AppSwitcher current={current} apps={apps} />
      <UserMenu
        email={email}
        fullName={fullName || email}
        initials={initials}
        theme={prefs.theme}
        sidebar={prefs.sidebar}
      />
    </header>
  );
}
