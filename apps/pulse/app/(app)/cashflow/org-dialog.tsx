'use client';

// The per-counterparty popup (Sjoerd 2026-07-08: "I want per org a popup.
// In the popup a list of opportunities and invoices... clicking on one,
// opens a popup with info... and adding one, opens a popup to add one.").
//
// One concern per screen: identity header + the two lists + Add. No
// org-level settings fields in v1. Clicking a row (or + Add) opens the
// EXISTING OpportunityDialog LAYERED ON TOP — the parent (pipeline-view)
// owns both open-states, renders this dialog before the inner one (later
// mount paints above) and guards this dialog's onClose so Escape only
// closes the top one.
//
// Contents are pure props: the parent recomputes the item list from the
// refreshed page data on every render, so an inner-dialog save (which
// router.refresh()es) flows straight back into these lists.

import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { commitmentNetTotal, type Commitment, type StageOption } from './types';

// Stage chips colour by KIND (same palette as the grid + table).
const KIND_STYLE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600',
  committed: 'bg-emerald-50 text-emerald-600',
  won: 'bg-slate-100 text-slate-500',
  lost: 'bg-slate-50 text-slate-400',
};
const UNKNOWN_STAGE_STYLE = 'bg-slate-50 text-slate-500';

// Deal total: offering items win, then quantity × unit price, else the sum
// of unsettled expected payments — the same number the counterparty table
// shows (shared rule in types.ts).
const itemTotal = commitmentNetTotal;

function fmtDate(intlLocale: string, iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function OrgDialog({
  name,
  items,
  stages,
  locale,
  onOpenItem,
  onAdd,
  onClose,
}: {
  name: string;
  items: Commitment[];
  stages: StageOption[];
  locale: Locale;
  onOpenItem: (cm: Commitment) => void; // opens OpportunityDialog layered on top
  onAdd: () => void; // opens OpportunityDialog for a NEW item, counterparty preselected
  onClose: () => void;
}) {
  const intl = INTL_LOCALES[locale];
  const stageByKey = new Map(stages.map((s) => [s.key, s]));

  // Net total (income − costs) across everything on this counterparty.
  const net = items.reduce((acc, cm) => {
    const t = itemTotal(cm);
    return acc + (cm.direction === 'out' ? -t : t);
  }, 0);

  // Opportunities: stage kind open/committed — still in the pipeline.
  const opportunities = items.filter((cm) => {
    const kind = stageByKey.get(cm.stage)?.kind;
    return kind === 'open' || kind === 'committed';
  });
  // Invoices & receivables: transferred to an invoice (invoice_no), at an
  // invoiced-kind stage (won = done/invoiced) OR carrying lines with an
  // invoice ref / invoiced date. An open item with an invoiced line shows in
  // BOTH groups — that's the point of the split.
  const invoiced = items.filter((cm) => {
    const kind = stageByKey.get(cm.stage)?.kind;
    return (
      Boolean(cm.invoice_no) ||
      kind === 'won' ||
      cm.lines.some((l) => l.invoice_ref || l.invoiced_at)
    );
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={name}
      description={
        <>
          {items.length === 1
            ? t(locale, 'n_items_one')
            : t(locale, 'n_items_many', { n: items.length })}{' '}
          · {t(locale, 'net_lc')}{' '}
          <span className={net < 0 ? 'text-rose-700' : 'text-emerald-700'}>
            {net < 0 ? '−' : ''}
            {money(Math.abs(net))}
          </span>
        </>
      }
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            className="mr-auto"
            leading={<Plus size={14} strokeWidth={2} />}
            onClick={onAdd}
          >
            {t(locale, 'add')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'close')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Group
          title={t(locale, 'opportunities')}
          empty={t(locale, 'no_pipeline_for_cp')}
        >
          {opportunities.map((cm) => {
            const stage = stageByKey.get(cm.stage);
            const total = itemTotal(cm);
            const isCost = cm.direction === 'out';
            return (
              <button
                key={cm.id}
                type="button"
                onClick={() => onOpenItem(cm)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-sunken"
              >
                <span
                  aria-hidden
                  title={isCost ? t(locale, 'cost') : t(locale, 'income')}
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isCost ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-ink">{cm.label}</span>
                {cm.invoice_no && (
                  <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-px text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                    {t(locale, 'invoice_no', { no: cm.invoice_no })}
                  </span>
                )}
                {/* Stage + probability are pipeline info — income only. On
                    costs they always read "committed / 100%": noise (Sjoerd
                    2026-07-09). The rose −amount stays the cost cue. */}
                {!isCost && (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-px text-xs font-medium ${
                      KIND_STYLE[stage?.kind ?? ''] ?? UNKNOWN_STAGE_STYLE
                    }`}
                  >
                    {stage?.label ?? cm.stage}
                  </span>
                )}
                {!isCost && (
                  <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                    {cm.probability}%
                  </span>
                )}
                <span
                  className={`shrink-0 text-sm font-medium tabular-nums ${
                    cm.direction === 'out' ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {cm.direction === 'out' ? '−' : ''}
                  {money(total)}
                </span>
              </button>
            );
          })}
        </Group>

        <Group
          title={t(locale, 'invoices_receivables')}
          empty={t(locale, 'no_invoices_yet')}
        >
          {invoiced.map((cm) => {
            const invoiceLines = cm.lines.filter((l) => l.invoice_ref || l.invoiced_at);
            // A won-stage item without invoice-marked lines still lists —
            // its expected payments ARE the receivables.
            const shown = invoiceLines.length > 0 ? invoiceLines : cm.lines;
            return (
              <button
                key={cm.id}
                type="button"
                onClick={() => onOpenItem(cm)}
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-sunken"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{cm.label}</span>
                  {cm.invoice_no && (
                    <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-px text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                      {t(locale, 'invoice_no', { no: cm.invoice_no })}
                    </span>
                  )}
                  <span
                    className={`shrink-0 text-sm font-medium tabular-nums ${
                      cm.direction === 'out'
                        ? 'text-rose-700'
                        : cm.invoice_no
                          ? 'text-sky-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {cm.direction === 'out' ? '−' : ''}
                    {money(shown.reduce((a, l) => a + l.amount_cents, 0))}
                  </span>
                </div>
                {shown.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {shown.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-2 pl-3.5 text-xs text-ink-muted"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {l.invoice_ref ? `#${l.invoice_ref}` : t(locale, 'expected_payment_lc')}
                        </span>
                        <span className="shrink-0 tabular-nums">{money(l.amount_cents)}</span>
                        <span className="shrink-0 w-32 text-right">
                          {l.settled_at
                            ? t(locale, 'settled_d', { d: fmtDate(intl, l.settled_at) })
                            : l.invoiced_at
                              ? t(locale, 'invoiced_d', { d: fmtDate(intl, l.invoiced_at) })
                              : t(locale, 'expected_d', { d: fmtDate(intl, l.expected_date) })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </Group>
      </div>
    </Dialog>
  );
}

function Group({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        {title}
        <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 py-px text-[11px] font-medium normal-case tracking-normal text-ink-subtle tabular-nums">
          {children.length}
        </span>
      </h3>
      {children.length === 0 ? (
        <p className="mt-1.5 px-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className="mt-1.5 divide-y divide-line/60">{children}</div>
      )}
    </section>
  );
}
