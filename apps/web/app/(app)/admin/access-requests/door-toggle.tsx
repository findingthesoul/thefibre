'use client';

// The signup door. ON (default) = self-serve: a signup approves itself,
// workspace + plan apps + welcome email, instantly. OFF = the velvet rope:
// requests queue here for a human decision. Takes effect within ~30s
// (settings cache) — the public site's copy follows it too.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAutoApprove } from './actions';

export function DoorToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function flip() {
    const next = !on;
    setError(null);
    start(async () => {
      const r = await setAutoApprove(next);
      if (r.error) {
        setError(r.error);
      } else {
        setOn(next);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={flip}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          on ? 'bg-emerald-600' : 'bg-line-strong'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            on ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <div className="text-sm">
        <div className="font-medium">{on ? 'Self-serve signup' : 'Approval required'}</div>
        <div className="text-xs text-ink-muted">
          {on
            ? 'New signups get their workspace instantly.'
            : 'New signups wait here for your decision.'}
        </div>
        {error && <div className="text-xs text-red-700">{error}</div>}
      </div>
    </div>
  );
}
