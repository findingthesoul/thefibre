'use client';

import { WorkspaceSync as Shared } from '@thefibre/shared/ui/workspace-sync';
import { browserSupabase } from '@/lib/supabase/client';

// This app's binding of the shared WorkspaceSync — see that file for why it
// exists and what it guards. Only the app-bound pieces live here: the browser
// Supabase client, whose env is this app's. Identical in every app on
// purpose; the behaviour is in @thefibre/shared.
export function WorkspaceSync({ stale, syncKey }: { stale: boolean; syncKey: string | null }) {
  return (
    <Shared
      stale={stale}
      syncKey={syncKey}
      refreshSession={() => browserSupabase().auth.refreshSession()}
      // A FULL document load, not router.refresh(). Measured on staging
      // 2026-10-11: with router.refresh() the token moved to the chosen
      // workspace correctly — the cookie's claim proved it — and the page
      // still rendered the OLD workspace, which only corrected itself on the
      // next navigation. So the person saw the wrong workspace exactly once
      // more, which is the symptom this whole change exists to remove.
      // A document load cannot race the cookie write, and this path runs at
      // most once per mount and only when the two actually disagree.
      onRefreshed={() => window.location.reload()}
    />
  );
}
