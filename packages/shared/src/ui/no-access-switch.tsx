'use client';

// "Continue in <workspace>" — the buttons on the no-access page. One per
// workspace where the app is usable. The switch itself is the app's own
// server action plus a token refresh (lib/workspace-actions.ts explains the
// two steps), injected as `onSwitch` by a per-app client wrapper — exactly
// how the user menu's workspace section is bound.

import { useState } from 'react';
import type { NoAccessAlternative } from '../no-access.js';

export function NoAccessSwitch({
  workspaces,
  onSwitch,
}: {
  workspaces: NoAccessAlternative[];
  onSwitch: (workspaceId: string) => Promise<{ error?: string }>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {workspaces.map((w) => (
        <button
          key={w.id}
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setError(null);
            setBusy(w.id);
            const r = await onSwitch(w.id);
            if (r.error) {
              setError(r.error);
              setBusy(null);
            }
            // On success the wrapper navigates; leave the button busy so a
            // second press cannot race the token refresh.
          }}
          className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
        >
          {busy === w.id ? 'Switching…' : `Continue in ${w.name}`}
        </button>
      ))}
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}
