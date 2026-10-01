'use client';

// Shim: the one avatar menu lives in @thefibre/shared/ui/user-menu
// (extraction phase 3). This file only wires the app-bound pieces —
// savePref, workspace switching, sign-out — as injected callbacks.

import { useRouter } from 'next/navigation';
import { Compass } from 'lucide-react';
import { UserMenu as SharedUserMenu, type WorkspaceChoice } from '@thefibre/shared/ui/user-menu';
import type { SidebarMode, Theme } from '@/lib/prefs-shared';
import { browserSupabase } from '@/lib/supabase/client';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_GETSTARTED } from '@/lib/prefs-shared';
import { t, type Locale } from '@/lib/i18n-ui';
import { switchWorkspace } from '@/lib/workspace-actions';

export type { WorkspaceChoice };

export function UserMenu(props: {
  email: string;
  fullName: string;
  initials: string;
  theme: Theme;
  sidebar: SidebarMode;
  workspaces?: WorkspaceChoice[];
  locale: Locale;
}) {
  const router = useRouter();
  const { locale, ...rest } = props;
  return (
    <SharedUserMenu
      {...rest}
      // An onboarding you put away has to be findable again, and the avatar
      // menu is where people look for the thing they turned off. It sends
      // you to the dashboard, because that is where the card lives — landing
      // on a page with no card would be its own small lie.
      extraItems={[
        {
          key: 'get-started',
          icon: Compass,
          label: t(locale, 'ob_reopen'),
          onClick: () => {
            void savePref(COOKIE_GETSTARTED, 'open').then(() => {
              router.push('/dashboard');
              router.refresh();
            });
          },
        },
      ]}
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
        await browserSupabase().auth.signOut({ scope: 'local' });
        router.push('/');
        router.refresh();
      }}
    />
  );
}
