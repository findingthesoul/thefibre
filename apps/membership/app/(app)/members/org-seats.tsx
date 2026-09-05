'use client';

// Seats under an ORG membership (§3.5 v1): who occupies them, occupancy vs
// allowance, add/remove (soft). Each seated person's access grants journal
// like an individual member's — adding a seat provisions, removing one
// revoke-flags (bought-product grants excepted, like individual lapses).

import { useCallback, useEffect, useState } from 'react';
import { StatusBadge } from './status-badge';
import { addSeat, listSeats, removeSeat, searchPersons } from './actions';
import { personName, type MemberPerson, type Seat } from './types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export function OrgSeats({ memberId }: { memberId: string }) {
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [occupied, setOccupied] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listSeats(memberId).then((r) => {
      if (r.error) {
        setError(r.error);
        setSeats([]);
        return;
      }
      setSeats(r.data?.items ?? []);
      setOccupied(r.data?.occupied ?? 0);
      setAllowance(r.data?.allowance ?? 0);
    });
  }, [memberId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Debounced person search (the add-member pattern — server action because
  // the API session lives server-side).
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchPersons(query.trim()).then((r) => setResults(r.data?.items ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function add(personId: string) {
    setBusy(true);
    setError(null);
    const r = await addSeat(memberId, personId);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setQuery('');
    setResults([]);
    reload();
  }

  async function remove(seatId: string) {
    setBusy(true);
    setError(null);
    const r = await removeSeat(memberId, seatId);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    reload();
  }

  const full = allowance > 0 && occupied >= allowance;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium">Seats</div>
        {seats !== null && (
          <span className={`text-xs ${full ? 'text-amber-700 dark:text-amber-400' : 'text-ink-muted'}`}>
            {occupied} of {allowance} seat{allowance === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {seats === null ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <>
          {seats.length === 0 ? (
            <p className="text-sm text-ink-muted">No one occupies a seat yet.</p>
          ) : (
            <ul className="rounded-md border border-line divide-y divide-line/60 overflow-hidden">
              {seats.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="text-ink">{personName(s.person)}</span>
                  {s.person?.email && <span className="text-ink-muted truncate">{s.person.email}</span>}
                  <span className="ml-auto">
                    <StatusBadge status={s.status} />
                  </span>
                  {s.status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(s.id)}
                      className="text-xs text-ink-subtle hover:text-red-700 underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={full ? 'All seats occupied — raise the allowance to add' : 'Add a person — search contacts…'}
              disabled={busy || full}
              className={`${INPUT} disabled:opacity-60`}
            />
            {results.length > 0 && !full && (
              <ul className="mt-1 rounded-md border border-line bg-surface-raised divide-y divide-line/60 overflow-hidden">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void add(p.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken disabled:opacity-50"
                    >
                      <span className="text-ink">{personName(p)}</span>
                      {p.email && <span className="ml-2 text-ink-muted">{p.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
