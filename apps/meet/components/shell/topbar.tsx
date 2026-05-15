import { UserMenu } from './user-menu';
import type { Prefs } from '@/lib/prefs-shared';

export function Topbar({
  email,
  fullName,
  prefs,
}: {
  email: string;
  fullName: string;
  prefs: Prefs;
}) {
  const initials =
    (fullName || email)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '·';

  return (
    <header className="h-14 shrink-0 border-b border-line flex items-center justify-end px-4 bg-surface">
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
