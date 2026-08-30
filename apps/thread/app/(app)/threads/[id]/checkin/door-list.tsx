'use client';

import { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, Search, Undo2 } from 'lucide-react';
import { checkinEnrolment } from '../../actions';

export type DoorRow = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  payment_status: string | null;
  checked_in_at: string | null;
};

export function DoorList({
  threadId,
  initialRows,
}: {
  threadId: string;
  initialRows: DoorRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const checkedIn = rows.filter((r) => r.checked_in_at).length;

  function toggle(row: DoorRow) {
    const undo = !!row.checked_in_at;
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      const r = await checkinEnrolment(threadId, row.id, undo);
      setBusyId(null);
      if (!r.ok) return setError(r.error);
      setRows((rs) =>
        rs.map((x) => (x.id === row.id ? { ...x, checked_in_at: r.checked_in_at } : x)),
      );
    });
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-sm text-ink-subtle">
        <span>
          <strong className="font-medium text-ink">{checkedIn}</strong> / {rows.length} checked in
        </span>
      </div>

      <div className="relative mt-3">
        <Search
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-base outline-none focus:border-ink"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink-subtle">
            {rows.length === 0 ? 'Nobody is registered yet.' : 'No match.'}
          </li>
        )}
        {visible.map((r) => {
          const done = !!r.checked_in_at;
          const note =
            r.status === 'invited'
              ? 'not approved yet'
              : r.payment_status === 'pending'
                ? 'payment pending'
                : null;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={busyId === r.id}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunken disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] ${done ? 'text-ink-subtle' : ''}`}>
                    {r.name}
                  </span>
                  {note && <span className="block text-xs text-amber-700">{note}</span>}
                </span>
                {done ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-green-700">
                    <CheckCircle2 size={18} />
                    {new Date(r.checked_in_at!).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    <Undo2 size={13} className="ml-1 text-ink-muted" />
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium">
                    Check in
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
