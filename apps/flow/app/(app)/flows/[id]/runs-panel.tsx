'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X, ChevronRight, Search } from 'lucide-react';
import { searchPersons, startRun } from '../actions';
import { RunModal } from './run-modal';

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };
export type Run = {
  id: string;
  status: string;
  entered_at: string;
  person: Person | Person[] | null;
  step: { key: string; name: string; kind: string } | { key: string; name: string; kind: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function personName(p: Person | null): string {
  if (!p) return 'Unknown';
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return n || p.email || 'Unknown';
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-blue-100 text-blue-800',
  withdrawn: 'bg-neutral-200 text-neutral-600',
};

export function RunsPanel({
  flowId,
  runs,
  canAdd,
}: {
  flowId: string;
  runs: Run[];
  canAdd: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">Contacts in this flow</h2>
        {canAdd && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-line-strong"
          >
            <UserPlus size={15} strokeWidth={1.75} />
            Add contact
          </button>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-line bg-white p-8 text-center text-sm text-ink-subtle">
          {canAdd
            ? 'No contacts in this flow yet. Add one to start moving them through.'
            : 'Publish the flow before adding contacts.'}
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => {
            const person = one(r.person);
            const step = one(r.step);
            return (
              <button
                key={r.id}
                onClick={() => setOpenRunId(r.id)}
                className="w-full text-left flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 hover:border-line-strong transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{personName(person)}</div>
                  {person?.email && <div className="text-xs text-ink-muted truncate">{person.email}</div>}
                </div>
                <div className="text-sm text-ink-subtle">{step?.name ?? '—'}</div>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    STATUS_STYLE[r.status] ?? ''
                  }`}
                >
                  {r.status}
                </span>
                <ChevronRight size={16} className="text-ink-muted shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {adding && <AddContactDialog flowId={flowId} onClose={() => setAdding(false)} />}
      {openRunId && <RunModal runId={openRunId} onClose={() => setOpenRunId(null)} />}
    </div>
  );
}

function AddContactDialog({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(value: string) {
    setQ(value);
    setSearching(true);
    const res = await searchPersons(value);
    setSearching(false);
    if (res.data) setResults(res.data);
  }

  async function pick(personId: string) {
    setBusy(true);
    setError(null);
    const res = await startRun(flowId, personId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data?.id) {
      router.push(`/runs/${res.data.id}`);
    } else {
      onClose();
      router.refresh();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-medium">Add a contact to the flow</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Search people by name or email"
              className="w-full rounded-md border border-line pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="mt-3 max-h-72 overflow-y-auto">
            {searching && <div className="text-sm text-ink-muted px-1 py-2">Searching…</div>}
            {!searching && results.length === 0 && (
              <div className="text-sm text-ink-muted px-1 py-2">
                {q ? 'No matches.' : 'Start typing to find a contact.'}
              </div>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => pick(p.id)}
                className="w-full text-left rounded-md px-3 py-2 hover:bg-surface-sunken disabled:opacity-60"
              >
                <div className="text-sm font-medium">{personName(p)}</div>
                {p.email && <div className="text-xs text-ink-muted">{p.email}</div>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
