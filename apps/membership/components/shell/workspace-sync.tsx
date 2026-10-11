'use client';

import { useRouter } from 'next/navigation';
import { WorkspaceSync as Shared } from '@thefibre/shared/ui/workspace-sync';
import { browserSupabase } from '@/lib/supabase/client';

// This app's binding of the shared WorkspaceSync — see that file for why it
// exists. Only the two app-bound pieces live here: the browser Supabase
// client (its env is this app's) and the router. Identical in every app on
// purpose; the behaviour is in @thefibre/shared.
export function WorkspaceSync({ stale }: { stale: boolean }) {
  const router = useRouter();
  return (
    <Shared
      stale={stale}
      refreshSession={() => browserSupabase().auth.refreshSession()}
      onRefreshed={() => router.refresh()}
    />
  );
}
