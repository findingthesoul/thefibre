'use client';

// Pulse's binding of the shared no-access switcher: the app's own switch
// action, then the token refresh, then home. Same three steps as the user
// menu; a page cannot pass a function from server to client, so the binding
// is this component (born in apps/thread on 2026-09-27, copied per app).

import { useRouter } from 'next/navigation';
import { NoAccessSwitch } from '@thefibre/shared/ui/no-access-switch';
import type { NoAccessSwitchProps } from '@thefibre/shared/no-access';
import { switchWorkspace } from '@/lib/workspace-actions';
import { browserSupabase } from '@/lib/supabase/client';

export function Switch({ workspaces }: NoAccessSwitchProps) {
  const router = useRouter();
  return (
    <NoAccessSwitch
      workspaces={workspaces}
      onSwitch={async (id) => {
        const r = await switchWorkspace(id);
        if (r.error) return r;
        // The workspace lives in the token — refreshSession() re-runs the
        // access-token hook, which stamps the workspace we just chose.
        await browserSupabase().auth.refreshSession();
        router.replace('/dashboard');
        router.refresh();
        return {};
      }}
    />
  );
}
