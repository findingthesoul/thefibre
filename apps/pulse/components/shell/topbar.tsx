// Shim: frame + initials rule live in @thefibre/shared/ui/topbar (extraction
// phase 3); the composed AppSwitcher/UserMenu stay app-side (server actions).

import { TopbarFrame, initialsOf } from '@thefibre/shared/ui/topbar';
import { UserMenu, type WorkspaceChoice } from './user-menu';
import { AppSwitcher, type AppEntry } from './app-switcher';
import type { Prefs } from '@/lib/prefs-shared';

export function Topbar({
  email,
  fullName,
  prefs,
  current,
  apps,
  workspaces = [],
  profileHref,
}: {
  email: string;
  fullName: string;
  prefs: Prefs;
  current: { slug: string; name: string };
  apps: AppEntry[];
  workspaces?: WorkspaceChoice[];
  /** Absolute URL of the ONE profile editor (Fibre web), env-aware from the layout. */
  profileHref?: string | null;
}) {
  return (
    <TopbarFrame
      left={<AppSwitcher current={current} apps={apps} />}
      right={
        <UserMenu
          email={email}
          fullName={fullName || email}
          initials={initialsOf(fullName, email)}
          theme={prefs.theme}
          sidebar={prefs.sidebar}
          workspaces={workspaces}
          profileHref={profileHref}
        />
      }
    />
  );
}
