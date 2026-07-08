'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { OpportunityDialog } from './opportunity-dialog';
import type { Commitment, Pickers } from './types';

// Chips colour by the stage's KIND, not its key — custom stages inherit the
// palette of their projection semantics. Unknown keys degrade to muted.
const KIND_STYLE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600',
  committed: 'bg-emerald-50 text-emerald-600',
  won: 'bg-slate-100 text-slate-500',
  lost: 'bg-slate-50 text-slate-400',
};
const UNKNOWN_STAGE_STYLE = 'bg-slate-50 text-slate-500';

export function PipelineView({
  items,
  pickers,
  currentUserId,
}: {
  items: Commitment[];
  pickers: Pickers;
  currentUserId: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);

  const stageByKey = new Map(pickers.stages.map((s) => [s.key, s]));

  // Group by counterparty (proposal §2.3 — the counterparty is the unit).
  const groups = new Map<string, { name: string; items: Commitment[] }>();
  for (const cm of items) {
    const name = cm.organisation?.name
      ?? (cm.person ? `${cm.person.first_name ?? ''} ${cm.person.last_name ?? ''}`.trim() : null)
      ?? 'No counterparty yet';
    const key = cm.organisation?.id ?? cm.person?.id ?? '—';
    const g = groups.get(key) ?? { name, items: [] };
    g.items.push(cm);
    groups.set(key, g);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Cashflow</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Expected money in and out, per counterparty — every line weighted by where it stands in the pipeline (a Fibre Flow).
          </p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
          New opportunity
        </Button>
      </div>

      {groups.size === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            No opportunities yet. Add your first with New opportunity — the importer seeds your
            current spreadsheet.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {[...groups.values()].map((g) => (
            <div key={g.name} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
                {g.name}
              </div>
              <div className="divide-y divide-line/60">
                {g.items.map((cm) => {
                  const open = cm.lines.filter((l) => !l.settled_at);
                  const total = open.reduce((a, l) => a + l.amount_cents, 0);
                  return (
                    <button
                      key={cm.id}
                      type="button"
                      onClick={() => setEditing(cm)}
                      className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink truncate">
                          {cm.label}
                          {cm.project && (
                            <span className="text-ink-muted"> · {cm.project.name}</span>
                          )}
                        </div>
                        <div className="text-xs text-ink-muted">
                          {open.length} expected payment{open.length === 1 ? '' : 's'}
                          {cm.direction === 'out' ? ' (outgoing)' : ''}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          KIND_STYLE[stageByKey.get(cm.stage)?.kind ?? ''] ?? UNKNOWN_STAGE_STYLE
                        }`}
                      >
                        {stageByKey.get(cm.stage)?.label ?? cm.stage}
                      </span>
                      <span className="text-xs text-ink-muted w-10 text-right">
                        {cm.probability}%
                      </span>
                      <span
                        className={`text-sm font-medium w-28 text-right ${cm.direction === 'out' ? 'text-red-600' : 'text-ink'}`}
                      >
                        {cm.direction === 'out' ? '−' : ''}
                        {money(total)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <OpportunityDialog
          commitment={null}
          pickers={pickers}
          currentUserId={currentUserId}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <OpportunityDialog
          commitment={editing}
          pickers={pickers}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
