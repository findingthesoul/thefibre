'use client';

// Emails about new and changed threads, one switch PER COMMUNITY — like the
// directory card, because a profile is shared across communities and a
// single switch would force someone in three to silence all three to quiet
// one. Off stops the email only; Notifications keeps the list.

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { SwitchField } from '@thefibre/shared/ui/switch';
import type { NotifyPref } from '@/lib/portal-api';

export function NotifyCard({ prefs }: { prefs: NotifyPref[] }) {
  const [state, setState] = useState(prefs);
  const [error, setError] = useState<string | null>(null);

  async function save(workspaceId: string, emailOn: boolean) {
    const before = state;
    // Optimistic, reverted on failure: a switch that moves when the save
    // failed is a lie about what we will send.
    setState((prev) => prev.map((p) => (p.workspace_id === workspaceId ? { ...p, email_off: !emailOn } : p)));
    setError(null);
    const res = await fetch('/api/notify-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, email_off: !emailOn }),
    }).catch(() => null);
    if (!res?.ok) {
      setState(before);
      setError('That did not save. Check your connection and try again.');
    }
  }

  if (!state.length) return null;
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Bell size={16} strokeWidth={1.75} />
        Emails about new and changed threads
      </h2>
      <div className="mt-3 space-y-4 rounded-2xl border border-line bg-surface p-5">
        {state.map((p) => (
          <SwitchField
            key={p.workspace_id}
            label={p.community ?? 'This community'}
            hint="One email after a quiet quarter of an hour, never one per change."
            checked={!p.email_off}
            onChange={(v) => void save(p.workspace_id, v)}
          />
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
