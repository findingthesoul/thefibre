'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X, ChevronRight, Search, LayoutGrid, List as ListIcon } from 'lucide-react';
import { searchPersons, startRun } from '../actions';
import { RunModal } from './run-modal';

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };
export type Run = {
  id: string;
  status: string;
  entered_at: string;
  current_step_entered_at?: string | null;
  person: Person | Person[] | null;
  step: { key: string; name: string; kind: string } | { key: string; name: string; kind: string }[] | null;
};

export type Step = { key: string; name: string; kind: string };

function one<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function personName(p: Person | null): string {
  if (!p) return 'Unknown';
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return n || p.email || 'Unknown';
}

function initials(p: Person | null): string {
  if (!p) return '?';
  return ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '') || p.email?.[0] || '?').toUpperCase();
}

function timeAtStep(iso?: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 mo' : `${months} mo`;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-indigo-50 text-indigo-700',
  withdrawn: 'bg-slate-100 text-slate-500',
};

const COL_ACCENT: Record<string, string> = {
  entry: 'border-t-indigo-300',
  normal: 'border-t-slate-300',
  end_positive: 'border-t-emerald-300',
  end_negative: 'border-t-rose-300',
};

export function RunsPanel({
  flowId,
  runs,
  steps,
  canAdd,
}: {
  flowId: string;
  runs: Run[];
  steps: Step[];
  canAdd: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [view, setView] = useState<'board' | 'list'>('board');

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">Contacts in this flow</h2>
        <div className="flex items-center gap-2">
          {runs.length > 0 && (
            <div className="inline-flex rounded-md border border-line overflow-hidden">
              <button
                onClick={() => setView('board')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs ${
                  view === 'board' ? 'bg-surface-sunken text-ink' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                <LayoutGrid size={14} /> Board
              </button>
              <button
                onClick={() => setView('list')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border-l border-line ${
                  view === 'list' ? 'bg-surface-sunken text-ink' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                <ListIcon size={14} /> List
              </button>
            </div>
          )}
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
      </div>

      {runs.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center text-sm text-ink-subtle">
          {canAdd
            ? 'No contacts in this flow yet. Add one to start moving them through.'
            : 'Publish the flow before adding contacts.'}
        </div>
      ) : view === 'board' ? (
        <Board runs={runs} steps={steps} onOpen={setOpenRunId} />
      ) : (
        <div className="space-y-2">
          {runs.map((r) => {
            const person = one(r.person);
            const step = one(r.step);
            return (
              <button
                key={r.id}
                onClick={() => setOpenRunId(r.id)}
                className="w-full text-left flex items-center gap-3 rounded-xl bg-white ring-1 ring-black/5 shadow-card hover:shadow-card-hover transition-shadow px-4 py-3"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium shrink-0">
                  {initials(person)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{personName(person)}</div>
                  {person?.email && <div className="text-xs text-ink-muted truncate">{person.email}</div>}
                </div>
                <div className="text-sm text-ink-subtle">{step?.name ?? '—'}</div>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
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

function Board({
  runs,
  steps,
  onOpen,
}: {
  runs: Run[];
  steps: Step[];
  onOpen: (id: string) => void;
}) {
  // Group active/completed runs by current step key. Withdrawn runs are shown
  // faded in their step column. Runs whose step isn't in the current version
  // fall into a trailing "Other" column.
  const byStep = new Map<string, Run[]>();
  for (const s of steps) byStep.set(s.key, []);
  const orphans: Run[] = [];
  for (const r of runs) {
    const step = one(r.step);
    const key = step?.key;
    if (key && byStep.has(key)) byStep.get(key)!.push(r);
    else orphans.push(r);
  }

  const columns: { step: Step; runs: Run[] }[] = steps.map((s) => ({ step: s, runs: byStep.get(s.key) ?? [] }));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-min">
        {columns.map(({ step, runs: col }) => (
          <div key={step.key} className="w-60 shrink-0">
            <div
              className={`rounded-t-lg border border-b-0 border-line border-t-2 ${
                COL_ACCENT[step.kind] ?? 'border-t-neutral-300'
              } bg-surface-sunken px-3 py-2 flex items-center justify-between`}
            >
              <span className="text-xs font-medium truncate">{step.name}</span>
              <span className="text-[11px] text-ink-muted tabular-nums">{col.length}</span>
            </div>
            <div className="rounded-b-lg border border-line bg-surface-sunken/40 p-2 space-y-2 min-h-[80px]">
              {col.length === 0 && <div className="text-[11px] text-ink-muted px-1 py-2">—</div>}
              {col.map((r) => {
                const person = one(r.person);
                const withdrawn = r.status === 'withdrawn';
                return (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                    className={`w-full text-left rounded-lg border border-line bg-white px-3 py-2 shadow-sm hover:shadow-md hover:border-line-strong transition-all ${
                      withdrawn ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white text-[10px] font-medium shrink-0">
                        {initials(person)}
                      </span>
                      <span className="text-sm font-medium truncate flex-1">{personName(person)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
                      <span>{timeAtStep(r.current_step_entered_at)}</span>
                      {withdrawn && <span className="uppercase tracking-wider">withdrawn</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {orphans.length > 0 && (
          <div className="w-60 shrink-0">
            <div className="rounded-t-lg border border-b-0 border-line border-t-2 border-t-neutral-300 bg-surface-sunken px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-medium truncate">Other</span>
              <span className="text-[11px] text-ink-muted tabular-nums">{orphans.length}</span>
            </div>
            <div className="rounded-b-lg border border-line bg-surface-sunken/40 p-2 space-y-2 min-h-[80px]">
              {orphans.map((r) => {
                const person = one(r.person);
                return (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                    className="w-full text-left rounded-md border border-line bg-white px-3 py-2 hover:border-line-strong"
                  >
                    <span className="text-sm font-medium truncate">{personName(person)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
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
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
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
