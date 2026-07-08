'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpportunityDialog } from './opportunity-dialog';
import { QuickAddButton } from './quick-add';
import { PeriodGrid } from './period-grid';
import { CounterpartyTable } from './counterparty-table';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_VIEW } from '@/lib/prefs-shared';
import type {
  BudgetLine,
  Commitment,
  PeriodSettings,
  Pickers,
  Projection,
  PulseAccount,
} from './types';

export function PipelineView({
  items,
  pickers,
  currentUserId,
  periodSettings,
  projection,
  budgetLines,
  accounts,
  initialView,
  initialFit,
}: {
  items: Commitment[];
  pickers: Pickers;
  currentUserId: string | null;
  periodSettings: PeriodSettings;
  // Admin-only reads — null/empty for non-admins; the grid degrades to
  // INCOME + COSTS without the position/reserves/end rows.
  projection: Projection | null;
  budgetLines: BudgetLine[];
  accounts: PulseAccount[];
  initialView: 'counterparty' | 'period';
  initialFit: 'on' | 'off';
}) {
  const [creating, setCreating] = useState<false | 'in' | 'out'>(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [view, setView] = useState<'counterparty' | 'period'>(initialView);

  return (
    <>
      <div className="flex items-start justify-between gap-4 max-w-6xl">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Cashflow</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Expected money in and out, per counterparty — every line weighted by where it stands in the pipeline (a Fibre Flow).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <QuickAddButton orgs={pickers.orgs} persons={pickers.persons} />
          <Button variant="secondary" onClick={() => setCreating('out')}>
            New cost
          </Button>
          <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating('in')}>
            New income
          </Button>
        </div>
      </div>

      {/* View toggle — list per counterparty vs. draggable per-period board. */}
      <div className="mt-6 inline-flex rounded-lg ring-1 ring-line bg-surface-raised p-0.5">
        {(
          [
            ['counterparty', 'By counterparty'],
            ['period', 'By period'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setView(key);
              void savePref(COOKIE_CASHFLOW_VIEW, key); // remembered per user
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === key
                ? 'bg-ink text-ink-inverse'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'period' ? (
        <PeriodGrid
          items={items}
          settings={periodSettings}
          stages={pickers.stages}
          projection={projection}
          budgetLines={budgetLines}
          accounts={accounts}
          initialFit={initialFit}
          onEdit={setEditing}
          onAdd={setCreating}
        />
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            Nothing here yet. Add your first with New income — the importer seeds your
            current spreadsheet.
          </p>
        </div>
      ) : (
        // Inline-editable, line per line (Sjoerd 2026-07-08) — the pencil at
        // the row end opens the full dialog.
        <CounterpartyTable items={items} stages={pickers.stages} onEdit={setEditing} />
      )}

      {creating && (
        <OpportunityDialog
          commitment={null}
          initialDirection={creating}
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
