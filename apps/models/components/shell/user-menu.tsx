'use client';

// Shim: the one avatar menu lives in @thefibre/shared/ui/user-menu
// (extraction phase 3). This file only wires the app-bound pieces —
// savePref, workspace switching, sign-out — as injected callbacks.
// Flow has no settings of its own — Settings points at the platform,
// env-aware (the old copy hardcoded production).

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
  workspaces?: WorkspaceChoice[];
}) {
  const router = useRouter();
  return (
    <SharedUserMenu
      {...props}
      profileHref={null}
      settingsHref={`${process.env.NEXT_PUBLIC_FIBRE_URL ?? 'https://thefibre.app'}/settings`}
      onSavePref={savePref}
      onSidebarChanged={() => router.refresh()}
      onSwitchWorkspace={async (id) => {
        const result = await switchWorkspace(id);
        if (result.error) return { error: result.error };
        // The workspace lives in the token — refreshSession() re-runs the
        // access-token hook, which stamps the workspace we just chose.
        await browserSupabase().auth.refreshSession();
        // Home, not here: whatever is on screen belongs to the workspace
        // being left.
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
