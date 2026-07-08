'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateStage } from './actions';
import { ERROR_CLS, INPUT_CLS, type Stage } from './shared';

// The pipeline is authored in Fibre Flow (flow "Pipeline", seeded with
// Pulse, undeletable while Pulse is active). This card is Pulse's READ-ONLY
// reflection of that flow — plus the one thing that IS Pulse's to edit:
// the money semantics (`kind`) each step carries in the projection.

const KIND_BADGE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600',
  committed: 'bg-emerald-50 text-emerald-600',
  won: 'bg-slate-100 text-slate-500',
  lost: 'bg-slate-50 text-slate-400',
};

const KIND_OPTIONS = [
  { value: 'open', label: 'Open — weighted by probability' },
  { value: 'committed', label: 'Committed — counts in full' },
  { value: 'won', label: 'Won — done' },
  { value: 'lost', label: 'Lost — excluded' },
] as const;
type StageKind = (typeof KIND_OPTIONS)[number]['value'];

export function StagesCard({ stages, flowUrl }: { stages: Stage[]; flowUrl: string | null }) {
  const [editing, setEditing] = useState<Stage | null>(null);
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Pipeline stages</span>
        {flowUrl && (
          <a
            href={flowUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-ink hover:underline"
          >
            Edit the flow in Fibre Flow
            <ExternalLink size={13} strokeWidth={1.75} />
          </a>
        )}
      </div>
      <p className="px-5 py-3 text-sm text-ink-muted border-b border-line/60">
        The pipeline is a Fibre Flow — steps, order and names are edited there and mirrored
        here. What each step <em>means for the money</em> (weighted, committed, won, lost) is
        set here, per stage.
      </p>
      {sorted.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">
          No stages visible. The Pipeline flow is seeded when Pulse is activated.
        </div>
      ) : (
        <div className="divide-y divide-line/60">
          {sorted.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center gap-3">
              <span className="text-xs text-ink-muted w-5 text-right tabular-nums">
                {s.sort_order}
              </span>
              <span className="flex-1 min-w-0 text-sm text-ink truncate">
                {s.label}
                {s.is_system && (
                  <span className="ml-2 text-xs font-normal text-ink-muted">default flow</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setEditing(s)}
                title="Change what this stage means for the projection"
                className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize hover:ring-1 hover:ring-line ${
                  KIND_BADGE[s.kind] ?? 'bg-slate-50 text-slate-500'
                }`}
              >
                {s.kind}
              </button>
            </div>
          ))}
        </div>
      )}
      {editing && <KindDialog stage={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function KindDialog({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<StageKind>(
    KIND_OPTIONS.some((k) => k.value === stage.kind) ? (stage.kind as StageKind) : 'open',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const res = await updateStage(stage.id, { kind });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${stage.label} — money semantics`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="stage-kind-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="stage-kind-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            How does money at this stage count?
          </label>
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
          <p className="mt-1 text-xs text-ink-muted">
            Terminal steps of the flow (positive/negative ends) are re-imposed as won/lost on
            the next sync. Rename or reorder the stage itself in Fibre Flow.
          </p>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
