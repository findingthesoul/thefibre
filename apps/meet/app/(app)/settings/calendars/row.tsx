'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setCalendarRole } from './actions';

export type Cal = {
  id: string;
  google_calendar_id: string;
  summary: string | null;
  role: 'primary' | 'conflict_check' | 'write_target' | 'ignore';
};

const ROLE_LABEL: Record<Cal['role'], string> = {
  primary: 'Primary',
  conflict_check: 'Conflict source',
  write_target: 'Write target',
  ignore: 'Ignore',
};

export function CalendarRow({ cal }: { cal: Cal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: Cal['role']) {
    setError(null);
    startTransition(async () => {
      const r = await setCalendarRole(cal.id, next);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">
          {cal.summary ?? cal.google_calendar_id}
        </div>
        <div className="mt-0.5 text-xs text-ink-muted truncate">
          {cal.google_calendar_id}
        </div>
        {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
      </div>
      <select
        value={cal.role}
        disabled={pending}
        onChange={(e) => change(e.target.value as Cal['role'])}
        className="rounded-md border border-line bg-surface-raised px-2 py-1 text-sm shrink-0"
      >
        {(['primary', 'conflict_check', 'write_target', 'ignore'] as const).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
    </li>
  );
}
