'use client';

// The "By counterparty" view as an inline-editable table (Sjoerd 2026-07-08:
// "just make it editable line per line, organised per org or pers"). One
// card per counterparty, one row per income/cost item; every cell edits in
// place (click → input/select, Enter/blur saves, Escape cancels) and PATCHes
// just that field. The dialog stays reachable via the pencil at the row end
// for everything else (payments, counterparty, notes…).

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { money } from '@/lib/money';
import { patchCommitmentField, type CommitmentFieldPatch } from './actions';
import type { Commitment, StageOption } from './types';

// Same column rhythm for the header and every row.
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_56px_96px_112px_112px_120px_60px_32px] gap-2 items-center';

// Stage chips colour by KIND (same palette as the period grid).
const KIND_STYLE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600',
  committed: 'bg-emerald-50 text-emerald-600',
  won: 'bg-slate-100 text-slate-500',
  lost: 'bg-slate-50 text-slate-400',
};
const UNKNOWN_STAGE_STYLE = 'bg-slate-50 text-slate-500';

const CADENCES = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'] as const;
type Cadence = (typeof CADENCES)[number];

// Euro string → integer cents. Accepts comma decimals ("1234,56").
function parseEuro(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Inline click-to-edit primitives (the account-balance cell pattern).
// ---------------------------------------------------------------------------
function InlineInput({
  display,
  displayClass = '',
  initial,
  alignRight,
  ariaLabel,
  inputMode,
  onCommit,
}: {
  display: React.ReactNode;
  displayClass?: string;
  initial: string;
  alignRight?: boolean;
  ariaLabel: string;
  inputMode?: 'decimal' | 'text';
  onCommit: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const cancelledRef = useRef(false);

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (!cancelledRef.current) onCommit(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            cancelledRef.current = true;
            e.currentTarget.blur();
          }
        }}
        inputMode={inputMode}
        aria-label={ariaLabel}
        className={`w-full rounded border border-line bg-white px-1.5 py-0.5 text-sm ${
          alignRight ? 'text-right tabular-nums' : ''
        } focus:outline-none focus:ring-2 focus:ring-neutral-300`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        cancelledRef.current = false;
        setValue(initial);
        setEditing(true);
      }}
      title="Click to edit"
      className={`block w-full min-w-0 truncate rounded px-1 py-0.5 hover:bg-slate-100 ${
        alignRight ? 'text-right tabular-nums' : 'text-left'
      } ${displayClass}`}
    >
      {display}
    </button>
  );
}

function InlineSelect({
  display,
  value,
  options,
  ariaLabel,
  onCommit,
}: {
  display: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={value}
        onChange={(e) => {
          setEditing(false);
          if (e.target.value !== value) onCommit(e.target.value);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label={ariaLabel}
        className="w-full rounded border border-line bg-white px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to change"
      className="block w-full min-w-0 truncate rounded px-1 py-0.5 text-left hover:bg-slate-100"
    >
      {display}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The table.
// ---------------------------------------------------------------------------
export function CounterpartyTable({
  items,
  stages,
  onEdit,
}: {
  items: Commitment[];
  stages: StageOption[];
  onEdit: (cm: Commitment) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Optimistic overrides per commitment — applied on save, kept until
  // router.refresh() brings the server truth, reverted (loudly) on error.
  const [overrides, setOverrides] = useState<Record<string, CommitmentFieldPatch>>({});
  // Fold state per counterparty group — default open (unfolded).
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  const stageByKey = new Map(stages.map((s) => [s.key, s]));
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  async function save(id: string, patch: CommitmentFieldPatch) {
    setError(null);
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
    const res = await patchCommitmentField(id, patch);
    if (res.error) {
      setError(`Could not save: ${res.error}`);
      setOverrides((o) => {
        const next = { ...o };
        delete next[id];
        return next;
      });
      return;
    }
    router.refresh();
  }

  // Group by counterparty (proposal §2.3 — the counterparty is the unit),
  // income before costs inside each group.
  const groups = new Map<string, { name: string; items: Commitment[] }>();
  for (const cm of items) {
    const name =
      cm.organisation?.name ??
      (cm.person ? `${cm.person.first_name ?? ''} ${cm.person.last_name ?? ''}`.trim() : null) ??
      'No counterparty yet';
    const key = cm.organisation?.id ?? cm.person?.id ?? '—';
    const g = groups.get(key) ?? { name, items: [] };
    g.items.push(cm);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    g.items.sort(
      (a, b) => a.direction.localeCompare(b.direction) || a.label.localeCompare(b.label),
    );
  }

  return (
    <div className="mt-8 space-y-6 max-w-6xl">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {[...groups.entries()].map(([gKey, g]) => {
        const open = !folded[gKey];
        // Net group total (income − costs) — stays visible when folded.
        const net = g.items.reduce((acc, cm) => {
          const view: Commitment = { ...cm, ...overrides[cm.id] };
          const openSum = view.lines
            .filter((l) => !l.settled_at)
            .reduce((a, l) => a + l.amount_cents, 0);
          const t =
            view.unit_amount_cents != null
              ? Math.round(view.quantity * view.unit_amount_cents)
              : openSum;
          return acc + (view.direction === 'out' ? -t : t);
        }, 0);
        return (
        <div key={gKey} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
          {/* Group row: unfold arrow at company level (Sjoerd 2026-07-08) —
              same chevron pattern as the period grid's section headers. */}
          <div
            className={`flex items-center justify-between gap-3 px-5 py-3 text-sm font-semibold tracking-tight ${
              open ? 'border-b border-line' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setFolded((f) => ({ ...f, [gKey]: !f[gKey] }))}
              aria-expanded={open}
              className="flex min-w-0 items-center gap-1.5 text-left"
            >
              {open ? (
                <ChevronDown size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
              ) : (
                <ChevronRight size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
              )}
              <span className="truncate">{g.name}</span>
              <span className="shrink-0 rounded-full bg-slate-200/70 px-1.5 py-px text-[11px] font-medium text-ink-subtle tabular-nums">
                {g.items.length}
              </span>
            </button>
            <span
              className={`shrink-0 text-xs font-medium tabular-nums ${
                net < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {net < 0 ? '−' : ''}
              {money(Math.abs(net))}
            </span>
          </div>
          {open && (
          <>
          <div className={`${ROW_GRID} px-5 py-1.5 border-b border-line/60 text-[11px] text-ink-muted`}>
            <span>Item</span>
            <span className="text-right">No.</span>
            <span className="text-right">Unit €</span>
            <span className="text-right">= Total</span>
            <span>Recurring</span>
            <span>Stage</span>
            <span className="text-right">Prob.</span>
            <span />
          </div>
          <div className="divide-y divide-line/60">
            {g.items.map((cm) => {
              // Server truth + any optimistic patch already saved from here.
              const view: Commitment = { ...cm, ...overrides[cm.id] };
              const isCost = view.direction === 'out';
              const stage = stageByKey.get(view.stage);
              const locked = stage?.kind === 'committed' || stage?.kind === 'won';
              const openSum = view.lines
                .filter((l) => !l.settled_at)
                .reduce((a, l) => a + l.amount_cents, 0);
              const total =
                view.unit_amount_cents != null
                  ? Math.round(view.quantity * view.unit_amount_cents)
                  : openSum;
              // Editing a stage key that vanished from the flow stays
              // selectable rather than silently moving the item.
              const stageOptions = (
                stage
                  ? sortedStages
                  : [...sortedStages, { key: view.stage, label: view.stage } as StageOption]
              ).map((s) => ({ value: s.key, label: s.label }));

              return (
                <div key={cm.id} className={`${ROW_GRID} px-5 py-1.5 text-sm`}>
                  {/* Label */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden
                      title={isCost ? 'Cost' : 'Income'}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isCost ? 'bg-rose-400' : 'bg-emerald-400'
                      }`}
                    />
                    <InlineInput
                      display={view.label}
                      displayClass="text-ink"
                      initial={view.label}
                      ariaLabel={`Label for ${view.label}`}
                      onCommit={(raw) => {
                        const v = raw.trim();
                        if (v && v !== view.label) void save(cm.id, { label: v });
                      }}
                    />
                  </div>

                  {/* No. (quantity) */}
                  <InlineInput
                    display={String(view.quantity)}
                    displayClass="text-ink"
                    initial={String(view.quantity)}
                    alignRight
                    inputMode="decimal"
                    ariaLabel={`Quantity for ${view.label}`}
                    onCommit={(raw) => {
                      const n = parseFloat(raw.trim().replace(',', '.'));
                      if (Number.isFinite(n) && n > 0 && n !== view.quantity) {
                        void save(cm.id, { quantity: n });
                      }
                    }}
                  />

                  {/* Unit price */}
                  <InlineInput
                    display={
                      view.unit_amount_cents != null ? (
                        money(view.unit_amount_cents)
                      ) : (
                        <span className="text-ink-muted/40 select-none">—</span>
                      )
                    }
                    displayClass="text-ink"
                    initial={
                      view.unit_amount_cents != null
                        ? (view.unit_amount_cents / 100).toFixed(2).replace('.', ',')
                        : ''
                    }
                    alignRight
                    inputMode="decimal"
                    ariaLabel={`Unit price for ${view.label}`}
                    onCommit={(raw) => {
                      if (!raw.trim()) {
                        if (view.unit_amount_cents != null) {
                          void save(cm.id, { unit_amount_cents: null });
                        }
                        return;
                      }
                      const cents = parseEuro(raw);
                      if (cents != null && cents !== view.unit_amount_cents) {
                        void save(cm.id, { unit_amount_cents: cents });
                      }
                    }}
                  />

                  {/* Total — computed, read-only */}
                  <span
                    title={
                      view.unit_amount_cents != null
                        ? 'Quantity × unit price'
                        : 'Sum of unsettled expected payments'
                    }
                    className={`px-1 text-right tabular-nums font-medium ${
                      isCost ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {isCost ? '−' : ''}
                    {money(total)}
                  </span>

                  {/* Recurring */}
                  <InlineSelect
                    display={
                      view.repeat_cadence ? (
                        <span className="rounded-full bg-sky-50 px-1.5 py-px text-xs font-medium text-sky-700">
                          ↻ {view.repeat_cadence}
                        </span>
                      ) : (
                        <span className="text-ink-muted/40 select-none">—</span>
                      )
                    }
                    value={view.repeat_cadence ?? ''}
                    options={[
                      { value: '', label: "Doesn't repeat" },
                      ...CADENCES.map((c) => ({ value: c, label: c })),
                    ]}
                    ariaLabel={`Recurring for ${view.label}`}
                    onCommit={(v) => {
                      if (v === '') {
                        void save(cm.id, { repeat_cadence: null });
                        return;
                      }
                      void save(cm.id, {
                        repeat_cadence: v as Cadence,
                        // A cadence needs a first occurrence — default today.
                        ...(view.repeat_starts_on ? {} : { repeat_starts_on: todayIso() }),
                      });
                    }}
                  />

                  {/* Stage — income only; costs have no pipeline semantics. */}
                  {isCost ? (
                    <span className="px-1 text-xs text-ink-muted">committed</span>
                  ) : (
                    <InlineSelect
                      display={
                        <span
                          className={`rounded-full px-1.5 py-px text-xs font-medium ${
                            KIND_STYLE[stage?.kind ?? ''] ?? UNKNOWN_STAGE_STYLE
                          }`}
                        >
                          {stage?.label ?? view.stage}
                        </span>
                      }
                      value={view.stage}
                      options={stageOptions}
                      ariaLabel={`Stage for ${view.label}`}
                      onCommit={(v) => void save(cm.id, { stage: v })}
                    />
                  )}

                  {/* Probability — locked at 100 once committed/won. */}
                  {isCost || locked ? (
                    <span
                      className="px-1 text-right text-xs text-ink-muted tabular-nums"
                      title={isCost ? 'Costs count in full' : 'Committed money counts in full'}
                    >
                      100%
                    </span>
                  ) : (
                    <InlineInput
                      display={`${view.probability}%`}
                      displayClass="text-ink text-xs"
                      initial={String(view.probability)}
                      alignRight
                      inputMode="decimal"
                      ariaLabel={`Probability for ${view.label}`}
                      onCommit={(raw) => {
                        const n = parseInt(raw.trim(), 10);
                        if (!Number.isFinite(n)) return;
                        const clamped = Math.min(100, Math.max(0, n));
                        if (clamped !== view.probability) {
                          void save(cm.id, { probability: clamped });
                        }
                      }}
                    />
                  )}

                  {/* Everything else (payments, counterparty, notes…) → dialog */}
                  <button
                    type="button"
                    aria-label={`Open ${view.label}`}
                    title="Open — payments, counterparty, notes…"
                    onClick={() => onEdit(view)}
                    className="h-7 w-7 inline-flex items-center justify-center justify-self-end rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
          </>
          )}
        </div>
        );
      })}
    </div>
  );
}
