'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createStage, deleteStage, swapStageOrder, updateStage } from './actions';
import { ERROR_CLS, INPUT_CLS, type Stage } from './shared';

// Same kind palette as the pipeline chips — the stage's KIND drives colour.
const KIND_BADGE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600',
  committed: 'bg-emerald-50 text-emerald-600',
  won: 'bg-slate-100 text-slate-500',
  lost: 'bg-slate-50 text-slate-400',
};

const KIND_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'committed', label: 'Committed' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
] as const;
type StageKind = (typeof KIND_OPTIONS)[number]['value'];

const KIND_EXPLANATION =
  'open = weighted by probability · committed = counts in full · won = done · lost = excluded';

export function StagesCard({ stages }: { stages: Stage[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Stage | 'new' | null>(null);
  const [reordering, setReordering] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const nextSortOrder = sorted.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;

  async function move(index: number, dir: -1 | 1) {
    const a = sorted[index];
    const b = sorted[index + dir];
    if (!a || !b || reordering) return;
    setReordering(true);
    setRowError(null);
    const res = await swapStageOrder(
      { id: a.id, sort_order: a.sort_order },
      { id: b.id, sort_order: b.sort_order },
    );
    setReordering(false);
    if (res.error) {
      setRowError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Pipeline stages</span>
        <Button
          size="sm"
          variant="secondary"
          leading={<Plus size={14} strokeWidth={2} />}
          onClick={() => setEditing('new')}
        >
          Add stage
        </Button>
      </div>
      <p className="px-5 py-3 text-sm text-ink-muted border-b border-line/60">
        The pipeline is a flow. The default sales flow ships with Pulse and can&apos;t be deleted —
        add your own stages around it.
      </p>
      {sorted.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">
          No stages visible. The default sales flow is seeded when Pulse is activated.
        </div>
      ) : (
        <div className="divide-y divide-line/60">
          {sorted.map((s, i) => (
            <div key={s.id} className="px-5 py-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(s)}
                className="flex-1 min-w-0 text-left text-sm text-ink hover:underline truncate"
              >
                {s.label}
                {s.is_system && (
                  <span className="ml-2 text-xs font-normal text-ink-muted">default flow</span>
                )}
              </button>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                  KIND_BADGE[s.kind] ?? 'bg-slate-50 text-slate-500'
                }`}
              >
                {s.kind}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move ${s.label} up`}
                  disabled={i === 0 || reordering}
                  onClick={() => move(i, -1)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronUp size={15} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${s.label} down`}
                  disabled={i === sorted.length - 1 || reordering}
                  onClick={() => move(i, 1)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronDown size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {rowError && (
        <div className="px-5 pb-3 pt-3">
          <div className={ERROR_CLS}>{rowError}</div>
        </div>
      )}
      {editing && (
        <StageDialog
          stage={editing === 'new' ? null : editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function StageDialog({
  stage,
  nextSortOrder,
  onClose,
}: {
  stage: Stage | null; // null = new
  nextSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(stage?.label ?? '');
  const [kind, setKind] = useState<StageKind>(
    KIND_OPTIONS.some((k) => k.value === stage?.kind) ? (stage!.kind as StageKind) : 'open',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = stage
      ? await updateStage(stage.id, { label: label.trim(), kind })
      : await createStage({ label: label.trim(), kind, sort_order: nextSortOrder });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!stage) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await deleteStage(stage.id);
    if (res.error) {
      // 409s (system stage / stage in use) arrive verbatim from the API.
      setError(res.error);
      setBusy(false);
      setConfirmDelete(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={stage ? 'Edit stage' : 'New stage'}
      footer={
        <>
          {stage && !stage.is_system && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              onClick={remove}
              disabled={busy}
            >
              {confirmDelete ? 'Really delete?' : 'Delete'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="stage-form" disabled={busy}>
            {busy ? 'Saving…' : stage ? 'Save' : 'Add stage'}
          </Button>
        </>
      }
    >
      <form id="stage-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Label</label>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Negotiation"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as StageKind)}
            className={INPUT_CLS}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">{KIND_EXPLANATION}</p>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
