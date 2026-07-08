'use client';

// The "spreadsheet feel" — unsettled expected payments laid out as one
// column per period, draggable between columns to retime them (HTML5 DnD →
// PATCH expected_date). Periods follow the workspace rhythm from
// pulse_settings; the walk mirrors the API's projection (boundary at-or-
// before today on the anchor grid).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { money } from '@/lib/money';
import { moveLine } from './actions';
import type { Commitment, Line, PeriodSettings } from './types';

const MS_PER_DAY = 86400000;
const PERIOD_COUNT = 10;

function todayUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Next `count` period start dates. Week/fortnight walk the anchor grid to
// the boundary at-or-before today (same as the API); months are calendar
// months starting with the current one.
function computePeriodStarts(s: PeriodSettings, count: number): string[] {
  const today = todayUTC();
  const starts: string[] = [];
  if (s.granularity === 'month') {
    for (let i = 0; i < count; i++) {
      starts.push(isoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1))));
    }
    return starts;
  }
  const step = s.granularity === 'week' ? 7 : 14;
  const anchor = s.anchor_date ? new Date(s.anchor_date + 'T00:00:00Z') : today;
  const daysFromAnchor = Math.floor((today.getTime() - anchor.getTime()) / MS_PER_DAY);
  const offset = ((daysFromAnchor % step) + step) % step;
  let cur = new Date(today.getTime() - offset * MS_PER_DAY);
  for (let i = 0; i < count; i++) {
    starts.push(isoDate(cur));
    cur = new Date(cur.getTime() + step * MS_PER_DAY);
  }
  return starts;
}

function fmtStart(iso: string, granularity: PeriodSettings['granularity']): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: granularity === 'month' ? undefined : 'numeric',
    month: 'short',
    year: granularity === 'month' ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

function counterpartyName(cm: Commitment): string {
  if (cm.organisation?.name) return cm.organisation.name;
  if (cm.person) {
    const full = `${cm.person.first_name ?? ''} ${cm.person.last_name ?? ''}`.trim();
    if (full) return full;
    if (cm.person.email) return cm.person.email;
  }
  return 'No counterparty yet';
}

type Card = { line: Line; cm: Commitment; date: string };
type Column = {
  key: string; // 'overdue' | 'later' | period start ISO date
  title: string;
  droppable: boolean;
  cards: Card[];
  weightedTotal: number;
};

export function PeriodBoard({
  items,
  settings,
  onEdit,
}: {
  items: Commitment[];
  settings: PeriodSettings;
  onEdit: (cm: Commitment) => void;
}) {
  const router = useRouter();
  // Optimistic overrides: lineId → expected_date, applied on drop and kept
  // until router.refresh() brings the server truth (reverted on error).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One extra start acts as the horizon — anything at-or-after it is "Later".
  const allStarts = useMemo(
    () => computePeriodStarts(settings, PERIOD_COUNT + 1),
    [settings],
  );
  const starts = allStarts.slice(0, PERIOD_COUNT);
  const horizon = allStarts[PERIOD_COUNT];

  const columns: Column[] = [
    { key: 'overdue', title: 'Overdue', droppable: false, cards: [], weightedTotal: 0 },
    ...starts.map((s) => ({
      key: s,
      title: fmtStart(s, settings.granularity),
      droppable: true,
      cards: [] as Card[],
      weightedTotal: 0,
    })),
    { key: 'later', title: 'Later', droppable: false, cards: [], weightedTotal: 0 },
  ];
  const byKey = new Map(columns.map((c) => [c.key, c]));

  for (const cm of items) {
    for (const line of cm.lines) {
      if (line.settled_at) continue;
      const date = overrides[line.id] ?? line.expected_date;
      let key: string;
      if (date < starts[0]) key = 'overdue';
      else if (date >= horizon) key = 'later';
      else key = [...starts].reverse().find((s) => s <= date) ?? starts[0];
      const col = byKey.get(key)!;
      col.cards.push({ line, cm, date });
      const sign = cm.direction === 'out' ? -1 : 1;
      col.weightedTotal += sign * line.amount_cents * (cm.probability / 100);
    }
  }
  for (const col of columns) {
    col.cards.sort((a, b) => a.date.localeCompare(b.date) || a.line.id.localeCompare(b.line.id));
  }
  const visible = columns.filter((c) => c.key !== 'later' || c.cards.length > 0);

  async function drop(colKey: string, e: React.DragEvent) {
    e.preventDefault();
    setHoverCol(null);
    const lineId = e.dataTransfer.getData('text/plain');
    if (!lineId) return;
    const col = byKey.get(colKey);
    if (!col?.droppable || col.cards.some((c) => c.line.id === lineId)) return;
    setError(null);
    setOverrides((o) => ({ ...o, [lineId]: colKey }));
    const res = await moveLine(lineId, colKey);
    if (res.error) {
      setError(res.error);
      setOverrides((o) => {
        const next = { ...o };
        delete next[lineId];
        return next;
      });
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex items-start gap-3 overflow-x-auto pb-4">
        {visible.map((col) => (
          <div
            key={col.key}
            onDragOver={
              col.droppable
                ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setHoverCol(col.key);
                  }
                : undefined
            }
            onDragLeave={
              col.droppable
                ? () => setHoverCol((h) => (h === col.key ? null : h))
                : undefined
            }
            onDrop={col.droppable ? (e) => drop(col.key, e) : undefined}
            className={`w-60 shrink-0 rounded-2xl bg-white shadow-card transition-shadow ${
              hoverCol === col.key ? 'ring-2 ring-neutral-400' : 'ring-1 ring-black/5'
            }`}
          >
            <div className="px-4 py-3 border-b border-line flex items-baseline justify-between gap-2">
              <span
                className={`text-sm font-semibold tracking-tight ${
                  col.key === 'overdue' ? 'text-rose-600' : 'text-ink'
                }`}
              >
                {col.title}
              </span>
              <span
                className={`text-xs font-medium tabular-nums ${
                  col.weightedTotal < 0 ? 'text-rose-600' : 'text-ink-muted'
                }`}
              >
                {money(Math.round(col.weightedTotal))}
              </span>
            </div>
            <div className="p-2 space-y-2 min-h-[96px]">
              {col.cards.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink-muted">No payments</div>
              ) : (
                col.cards.map((card) => (
                  <div
                    key={card.line.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', card.line.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => onEdit(card.cm)}
                    className="cursor-grab active:cursor-grabbing rounded-lg bg-surface-raised ring-1 ring-black/5 shadow-sm px-3 py-2 hover:ring-neutral-300"
                  >
                    <div className="text-sm text-ink truncate">{card.cm.label}</div>
                    <div className="text-xs text-ink-muted truncate">{counterpartyName(card.cm)}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          card.cm.direction === 'out' ? 'text-rose-600' : 'text-ink'
                        }`}
                      >
                        {card.cm.direction === 'out' ? '−' : ''}
                        {money(card.line.amount_cents)}
                      </span>
                      {card.line.invoiced_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                          <FileText size={11} strokeWidth={2} />
                          invoiced
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
