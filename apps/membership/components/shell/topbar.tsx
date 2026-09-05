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
}: {
  email: string;
  fullName: string;
  prefs: Prefs;
  current: { slug: string; name: string };
  apps: AppEntry[];
  workspaces?: WorkspaceChoice[];
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
        />
      }
    />
  );
}
