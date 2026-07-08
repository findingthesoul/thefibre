'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, ChevronRight, Search, LayoutGrid, List as ListIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { searchPersons, startRun } from '../actions';
import { RunModal } from './run-modal';
import {
  one,
  personDisplayName,
  runSubjectName,
  runSubjectInitials,
  isPulseRun,
  PULSE_BADGE_TITLE,
  type RunPerson as Person,
  type RunOrganisation,
} from '@/lib/run-subject';

export type Run = {
  id: string;
  status: string;
  entered_at: string;
  current_step_entered_at?: string | null;
  person: Person | Person[] | null;
  organisation?: RunOrganisation | RunOrganisation[] | null;
  subject_label?: string | null;
  source_app?: string | null;
  step: { key: string; name: string; kind: string } | { key: string; name: string; kind: string }[] | null;
};

export type Step = {
  key: string;
  name: string;
  kind: string;
  canvas_x?: number | null;
  canvas_y?: number | null;
};

function PulseChip() {
  return (
    <span
      title={PULSE_BADGE_TITLE}
      className="bg-yellow-100 text-ink text-[10px] rounded-full px-1.5 py-0.5 shrink-0"
    >
      Pulse
    </span>
  );
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

const KIND_DOT: Record<string, string> = {
  entry: 'bg-indigo-500',
  normal: 'bg-slate-300',
  end_positive: 'bg-emerald-500',
  end_negative: 'bg-rose-500',
  loop: 'bg-amber-500',
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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [view, setView] = useState<'board' | 'list'>('board');

  // Board drag-and-drop: open the run popup with the move pre-selected, so
  // the existing gated-confirm / manual-move logic handles it.
  function onBoardMove(runId: string, stepKey: string) {
    const run = runs.find((r) => r.id === runId);
    if (!run || one(run.step)?.key === stepKey) return;
    setPendingKey(stepKey);
    setOpenRunId(runId);
  }

  function closeModal() {
    setOpenRunId(null);
    setPendingKey(null);
  }

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
        <Board runs={runs} steps={steps} onOpen={setOpenRunId} onMove={onBoardMove} />
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
                  {runSubjectInitials(r)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">{runSubjectName(r)}</span>
                    {isPulseRun(r) && <PulseChip />}
                  </div>
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
      {openRunId && (
        <RunModal runId={openRunId} onClose={closeModal} initialTargetKey={pendingKey} />
      )}
    </div>
  );
}

function Board({
  runs,
  steps,
  onOpen,
  onMove,
}: {
  runs: Run[];
  steps: Step[];
  onOpen: (id: string) => void;
  onMove: (runId: string, stepKey: string) => void;
}) {
  // Drag a card to another column → onMove opens the confirm popup (gated or
  // manual) via the run modal.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // Columns follow the builder's left-to-right layout (canvas_x, then
  // canvas_y); steps without saved positions keep their stored order.
  const ordered = [...steps].sort(
    (a, b) =>
      (a.canvas_x ?? Number.MAX_SAFE_INTEGER) - (b.canvas_x ?? Number.MAX_SAFE_INTEGER) ||
      (a.canvas_y ?? 0) - (b.canvas_y ?? 0),
  );

  // Group active/completed runs by current step key. Withdrawn runs are shown
  // faded in their step column. Runs whose step isn't in the current version
  // fall into a trailing "Other" column.
  const byStep = new Map<string, Run[]>();
  for (const s of ordered) byStep.set(s.key, []);
  const orphans: Run[] = [];
  for (const r of runs) {
    const step = one(r.step);
    const key = step?.key;
    if (key && byStep.has(key)) byStep.get(key)!.push(r);
    else orphans.push(r);
  }

  const columns: { step: Step; runs: Run[] }[] = ordered.map((s) => ({ step: s, runs: byStep.get(s.key) ?? [] }));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-min">
        {columns.map(({ step, runs: col }) => (
          <div
            key={step.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOverKey(step.key);
            }}
            onDragLeave={() => setOverKey((k) => (k === step.key ? null : k))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain') || dragId;
              setOverKey(null);
              setDragId(null);
              if (id) onMove(id, step.key);
            }}
            className={`w-64 shrink-0 rounded-2xl bg-slate-500/[0.07] p-2 transition-shadow ${
              dragId && overKey === step.key ? 'ring-2 ring-indigo-300 bg-indigo-100/40' : ''
            }`}
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="flex items-center gap-2 text-xs font-medium truncate">
                <span className={`h-2 w-2 rounded-full shrink-0 ${KIND_DOT[step.kind] ?? KIND_DOT.normal}`} />
                {step.name}
              </span>
              <span className="text-[11px] text-ink-subtle tabular-nums rounded-full bg-white ring-1 ring-black/5 px-2 py-0.5">
                {col.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[72px]">
              {col.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300/70 px-3 py-4 text-center text-[11px] text-ink-muted">
                  No one here
                </div>
              )}
              {col.map((r) => {
                const withdrawn = r.status === 'withdrawn';
                return (
                  <button
                    key={r.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', r.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragId(r.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverKey(null);
                    }}
                    onClick={() => onOpen(r.id)}
                    className={`w-full text-left rounded-xl bg-white ring-1 ring-black/5 px-3.5 py-2.5 shadow-card hover:shadow-card-hover transition-all cursor-grab active:cursor-grabbing ${
                      withdrawn ? 'opacity-50' : ''
                    } ${dragId === r.id ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-medium shrink-0">
                        {runSubjectInitials(r)}
                      </span>
                      <span className="text-sm font-medium truncate flex-1">{runSubjectName(r)}</span>
                      {isPulseRun(r) && <PulseChip />}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-muted">
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
          <div className="w-64 shrink-0 rounded-2xl bg-slate-500/[0.07] p-2">
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="flex items-center gap-2 text-xs font-medium truncate">
                <span className="h-2 w-2 rounded-full shrink-0 bg-slate-300" />
                Other
              </span>
              <span className="text-[11px] text-ink-subtle tabular-nums rounded-full bg-white ring-1 ring-black/5 px-2 py-0.5">
                {orphans.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[72px]">
              {orphans.map((r) => {
                return (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                    className="w-full text-left rounded-xl bg-white ring-1 ring-black/5 px-3.5 py-2.5 shadow-card hover:shadow-card-hover transition-all"
                  >
                    <span className="inline-flex items-center gap-1.5 max-w-full">
                      <span className="text-sm font-medium truncate">{runSubjectName(r)}</span>
                      {isPulseRun(r) && <PulseChip />}
                    </span>
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
    <Dialog open onClose={onClose} title="Add a contact to the flow">
      <div>
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
                <div className="text-sm font-medium">{personDisplayName(p)}</div>
                {p.email && <div className="text-xs text-ink-muted">{p.email}</div>}
              </button>
            ))}
          </div>
      </div>
    </Dialog>
  );
}
