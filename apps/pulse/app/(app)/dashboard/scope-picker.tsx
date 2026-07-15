'use client';

// The home page's cashflow chooser (Sjoerd 2026-07-15: "in the home page you
// should be able to select the cashflow of pref you want to land on"). It
// writes the SAME COOKIE_CASHFLOW_SCOPE the cashflow tab bar uses, so the
// choice is the shared "preferred cashflow": the dashboard projection AND the
// grid both land on it next time. Selecting refreshes the dashboard in place
// (it does not navigate to /cashflow).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_SCOPE } from '@/lib/prefs-shared';

export function DashboardScopePicker({
  currentKey,
  teams,
  canWorkspace,
  workspaceName,
}: {
  currentKey: string; // 'me' | `team:${id}` | 'workspace'
  teams: { id: string; name: string }[];
  canWorkspace: boolean;
  workspaceName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Only render a chooser when there's more than one cashflow to choose from.
  const hasChoice = teams.length > 0 || canWorkspace;
  if (!hasChoice) return null;

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (busy || val === currentKey) return;
    setBusy(true);
    await savePref(COOKIE_CASHFLOW_SCOPE, val);
    router.refresh();
    setBusy(false);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">Cashflow</span>
      <select
        value={currentKey}
        onChange={onChange}
        disabled={busy}
        aria-label="Which cashflow to show"
        className="h-9 rounded-md border border-line bg-white px-2.5 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-60"
      >
        <option value="me">Me</option>
        {teams.map((t) => (
          <option key={t.id} value={`team:${t.id}`}>
            {t.name}
          </option>
        ))}
        {canWorkspace && <option value="workspace">{workspaceName || 'Workspace'}</option>}
      </select>
    </label>
  );
}
