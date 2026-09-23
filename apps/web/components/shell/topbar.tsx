// Shim: frame + initials rule live in @thefibre/shared/ui/topbar (extraction
// phase 3); the composed AppSwitcher/UserMenu stay app-side (server actions).

import { TopbarFrame, initialsOf } from '@thefibre/shared/ui/topbar';
import { UserMenu, type WorkspaceChoice } from './user-menu';
import { AppSwitcher, type AppEntry } from './app-switcher';
import { TodoButton } from './todo';
import type { Prefs } from '@/lib/prefs-shared';

export function Topbar({
  todoEnabled = true,
  email,
  fullName,
  prefs,
  current,
  apps,
  workspaces = [],
}: {
  /** Whether this person wants the To do panel at all (Settings → Profile).
   *  Off hides the button entirely, and the open cookie is simply not read. */
  todoEnabled?: boolean;
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
        <div className="flex items-center gap-2">
          {/* Beside your own icon, per Sjoerd: the list toggles from here.
              Switched off in Settings → Profile, it is not here at all. */}
          {todoEnabled && <TodoButton initialOpen={prefs.todo === 'open'} />}
          <UserMenu
            email={email}
            fullName={fullName || email}
            initials={initialsOf(fullName, email)}
            theme={prefs.theme}
            sidebar={prefs.sidebar}
            workspaces={workspaces}
          />
        </div>
      }
    />
  );
}
