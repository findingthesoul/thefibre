'use client';

// The "By counterparty" view as an inline-editable table (Sjoerd 2026-07-08:
// "just make it editable line per line, organised per org or pers"). One
// card per counterparty, one row per income/cost item; every cell edits in
// place (click → input/select, Enter/blur saves, Escape cancels) and PATCHes
// just that field. The dialog stays reachable via the pencil at the row end
// for everything else (payments, counterparty, notes…).

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { money } from '@/lib/money';
import { patchCommitmentField, type CommitmentFieldPatch } from './actions';
import { toastError } from './toast';
import {
  commitmentNetTotal,
  loadOpenGroups,
  saveOpenGroups,
  type Commitment,
  type StageOption,
} from './types';

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
  onEditingChange,
}: {
  display: React.ReactNode;
  displayClass?: string;
  initial: string;
  alignRight?: boolean;
  ariaLabel: string;
  inputMode?: 'decimal' | 'text';
  onCommit: (raw: string) => void;
  // Focus mode (Sjoerd 2026-07-09: "when working IN an item... others are
  // closed") — the table listens to know which row is being worked in.
  onEditingChange?: (editing: boolean) => void;
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
          onEditingChange?.(false);
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
        onEditingChange?.(true);
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
  onEditingChange,
}: {
  display: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  onCommit: (v: string) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);

  function end() {
    setEditing(false);
    onEditingChange?.(false);
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={value}
        onChange={(e) => {
          end();
          if (e.target.value !== value) onCommit(e.target.value);
        }}
        onBlur={end}
        onKeyDown={(e) => {
          if (e.key === 'Escape') end();
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
      onClick={() => {
        setEditing(true);
        onEditingChange?.(true);
      }}
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
  onOpenGroup,
}: {
  items: Commitment[];
  stages: StageOption[];
  onEdit: (cm: Commitment) => void;
  // Clicking the counterparty NAME opens the per-org popup ("I want per org
  // a popup") — the chevron keeps folding; separate hit areas.
  onOpenGroup: (key: string) => void;
}) {
  const router = useRouter();
  // Optimistic overrides per commitment — applied on save, kept until
  // router.refresh() brings the server truth, reverted (loudly, via a
  // toast) on error.
  const [overrides, setOverrides] = useState<Record<string, CommitmentFieldPatch>>({});
  // Groups default CLOSED; the open set is the latest visit's, restored from
  // localStorage on mount (Sjoerd 2026-07-09: "store pref of the latest
  // visit"). Loaded in an effect — the server render must match the first
  // client render (default closed) to avoid a hydration mismatch.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpenGroups(loadOpenGroups('counterparty'));
  }, []);
  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveOpenGroups('counterparty', next);
      return next;
    });
  }
  // Focus mode (Sjoerd 2026-07-09: "when working IN an item... others are
  // closed... pushed forward"): the commitment id being inline-edited. Other
  // groups render as-if-folded (manual state untouched — it restores when
  // focus ends); the active row scales forward, siblings de-emphasize.
  const [focusId, setFocusId] = useState<string | null>(null);

  const stageByKey = new Map(stages.map((s) => [s.key, s]));
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  async function save(id: string, patch: CommitmentFieldPatch) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
    const res = await patchCommitmentField(id, patch);
    if (res.error) {
      toastError(`Could not save: ${res.error}`);
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
      {[...groups.entries()].map(([gKey, g]) => {
        const groupHasFocus = focusId != null && g.items.some((i) => i.id === focusId);
        // Focus mode collapses the OTHER groups as if their chevrons closed;
        // the manual open-set is untouched and restores when focus ends.
        const open = focusId ? groupHasFocus : openGroups.has(gKey);
        // Net group total (income − costs) — stays visible when folded.
        const net = g.items.reduce((acc, cm) => {
          const view: Commitment = { ...cm, ...overrides[cm.id] };
          const t = commitmentNetTotal(view);
          return acc + (view.direction === 'out' ? -t : t);
        }, 0);
        return (
        <div
          key={gKey}
          className={`rounded-2xl bg-white ring-1 ring-black/5 shadow-card transition-opacity ${
            focusId && !groupHasFocus ? 'opacity-60' : ''
          }`}
        >
          {/* Group row: default closed — a click on the row (or chevron)
              opens it (Sjoerd 2026-07-09); the NAME opens the org popup. */}
          <div
            onClick={() => {
              if (!focusId) toggleGroup(gKey);
            }}
            className={`flex cursor-pointer items-center justify-between gap-3 px-5 py-3 text-sm font-semibold tracking-tight ${
              open ? 'border-b border-line' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {/* Two hit areas: the row/chevron folds, the NAME opens the
                  org popup (Sjoerd 2026-07-08: "I want per org a popup"). */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(gKey);
                }}
                aria-expanded={open}
                aria-label={`${open ? 'Fold' : 'Unfold'} ${g.name}`}
                className="shrink-0 -m-1 p-1"
              >
                {open ? (
                  <ChevronDown size={13} strokeWidth={2} className="text-ink-subtle" />
                ) : (
                  <ChevronRight size={13} strokeWidth={2} className="text-ink-subtle" />
                )}
              </button>
              {gKey === '—' ? (
                <span className="truncate" title={g.name}>{g.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenGroup(gKey);
                  }}
                  title="Open — opportunities & invoices"
                  className="min-w-0 truncate text-left hover:underline underline-offset-2"
                >
                  {g.name}
                </button>
              )}
              <span className="shrink-0 rounded-full bg-slate-200/70 px-1.5 py-px text-[11px] font-medium text-ink-subtle tabular-nums">
                {g.items.length}
              </span>
            </div>
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
              const total = commitmentNetTotal(view);
              // Editing a stage key that vanished from the flow stays
              // selectable rather than silently moving the item.
              const stageOptions = (
                stage
                  ? sortedStages
                  : [...sortedStages, { key: view.stage, label: view.stage } as StageOption]
              ).map((s) => ({ value: s.key, label: s.label }));
              // Focus mode: the active row pushes forward, its group
              // siblings step back (Sjoerd 2026-07-09: "like pushed forward").
              const isActive = focusId === cm.id;
              const isSibling = focusId != null && groupHasFocus && !isActive;
              const rowFocus = (ed: boolean) =>
                setFocusId((cur) => (ed ? cm.id : cur === cm.id ? null : cur));

              return (
                <div
                  key={cm.id}
                  className={`${ROW_GRID} px-5 py-1.5 text-sm transition-[transform,opacity,box-shadow] duration-150 ${
                    isActive
                      ? 'relative z-10 scale-[1.05] origin-left rounded-md bg-white shadow-md ring-1 ring-neutral-300'
                      : isSibling
                        ? 'opacity-60'
                        : ''
                  }`}
                >
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
                      onEditingChange={rowFocus}
                      onCommit={(raw) => {
                        const v = raw.trim();
                        if (v && v !== view.label) void save(cm.id, { label: v });
                      }}
                    />
                    {view.invoice_no && (
                      <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                        Invoice {view.invoice_no}
                      </span>
                    )}
                  </div>

                  {/* No. (quantity) */}
                  <InlineInput
                    display={String(view.quantity)}
                    displayClass="text-ink"
                    initial={String(view.quantity)}
                    alignRight
                    inputMode="decimal"
                    ariaLabel={`Quantity for ${view.label}`}
                    onEditingChange={rowFocus}
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
                    onEditingChange={rowFocus}
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
                      view.items && view.items.length > 0
                        ? 'Sum of the offering rows'
                        : view.unit_amount_cents != null
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

                  {/* Recurring — editable everywhere; the ↻ chip is an
                      income-only visual (on costs it's noise — Sjoerd
                      2026-07-09; the rose −amount is the cost cue). */}
                  <InlineSelect
                    display={
                      view.repeat_cadence ? (
                        isCost ? (
                          <span className="text-xs text-ink-muted">{view.repeat_cadence}</span>
                        ) : (
                          <span className="rounded-full bg-sky-50 px-1.5 py-px text-xs font-medium text-sky-700">
                            ↻ {view.repeat_cadence}
                          </span>
                        )
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
                    onEditingChange={rowFocus}
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

                  {/* Stage — income only; on costs it always reads
                      "committed": noise, so nothing renders. */}
                  {isCost ? (
                    <span className="px-1 text-ink-muted/40 select-none">—</span>
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
                      onEditingChange={rowFocus}
                      onCommit={(v) => {
                        // Entering a stage takes its default probability
                        // (unless the kind forces 100); pinned explicitly so
                        // the optimistic row shows the same number the API
                        // would apply. User can still edit after.
                        const next = stageByKey.get(v);
                        const prob =
                          next?.kind === 'committed' || next?.kind === 'won'
                            ? 100
                            : (next?.default_probability ?? view.probability);
                        void save(cm.id, { stage: v, probability: prob });
                      }}
                    />
                  )}

                  {/* Probability — locked at 100 once committed/won; blank
                      on costs (they always count in full). */}
                  {isCost ? (
                    <span className="px-1 text-right text-ink-muted/40 select-none">—</span>
                  ) : locked ? (
                    <span
                      className="px-1 text-right text-xs text-ink-muted tabular-nums"
                      title="Committed money counts in full"
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
                      onEditingChange={rowFocus}
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
