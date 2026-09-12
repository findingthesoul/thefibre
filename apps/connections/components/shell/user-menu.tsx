'use client';

// Shim: the one avatar menu lives in @thefibre/shared/ui/user-menu
// (extraction phase 3). This file only wires Pulse's app-bound pieces —
// savePref, workspace switching, sign-out — as injected callbacks.

import { useRouter } from 'next/navigation';
import { UserMenu as SharedUserMenu, type WorkspaceChoice } from '@thefibre/shared/ui/user-menu';
import type { SidebarMode, Theme } from '@/lib/prefs-shared';
import { browserSupabase } from '@/lib/supabase/client';
import { savePref } from '@/lib/prefs-actions';
import { switchWorkspace } from '@/lib/workspace-actions';

export type { WorkspaceChoice };

export function UserMenu(props: {
  email: string;
  fullName: string;
  initials: string;
  theme: Theme;
  sidebar: SidebarMode;
  /** Only the ones this app can actually be used in; see the layout. */
  workspaces?: WorkspaceChoice[];
  profileHref?: string | null;
}) {
  const router = useRouter();
  return (
    <SharedUserMenu
      {...props}
      onSavePref={savePref}
      onSidebarChanged={() => router.refresh()}
      onSwitchWorkspace={async (id) => {
        const result = await switchWorkspace(id);
        if (result.error) return { error: result.error };
        // The workspace lives in the token, so recording the choice changes
        // nothing until a new token is issued. refreshSession() re-runs the
        // access-token hook, which stamps the workspace we just chose.
        await browserSupabase().auth.refreshSession();
        // Home, not here: whatever is on screen belongs to the workspace being
        // left, and a record id from one tenant is nothing in another.
        router.replace('/dashboard');
        router.refresh();
        return {};
      }}
      onSignOut={async () => {
        await browserSupabase().auth.signOut();
        router.push('/');
        router.refresh();
      }}
    />
  );
}
