'use client';

// Shim: the one avatar menu lives in @thefibre/shared/ui/user-menu
// (extraction phase 3). This file only wires Pulse's app-bound pieces —
// savePref, workspace switching, sign-out — as injected callbacks.

import { useRouter } from 'next/navigation';
import { safely } from '@/lib/safely';
import { UserMenu as SharedUserMenu, type WorkspaceChoice } from '@thefibre/shared/ui/user-menu';
import type { SidebarMode, Theme } from '@/lib/prefs-shared';
import { browserSupabase } from '@/lib/supabase/client';
import { savePref } from '@/lib/prefs-actions';
import { switchWorkspace } from '@/lib/workspace-actions';
import { saveNote } from '@/app/(app)/people/[id]/actions';
import { clearOfflineData, flushQueuedNotes } from '@/lib/offline-notes';

/** The service worker's caches hold app shell files, not personal data, but a
 *  signed-out device should not keep even those tied to a session. */
async function clearServiceWorkerCaches(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('connections-')).map((k) => caches.delete(k)));
  } catch {
    /* nothing further possible */
  }
}

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
        // A failed CALL — not a failed switch — used to reject out of this
        // handler, leaving the menu's own spinner running with nothing said.
        const result = await safely(
          () => switchWorkspace(id),
          (error) => ({ error }),
        );
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
        // Leave nothing of this person's on the device. Waiting notes are
        // attempted first, then cleared either way — signing out of a phone
        // is saying "remove me from it", and conversation notes are the most
        // sensitive text in the system. See clearOfflineData.
        try {
          if (navigator.onLine) await flushQueuedNotes((p) => saveNote(p as never));
        } catch {
          /* best effort; clearing below still happens */
        }
        clearOfflineData();
        await clearServiceWorkerCaches();
        await browserSupabase().auth.signOut();
        router.push('/');
        router.refresh();
      }}
    />
  );
}
