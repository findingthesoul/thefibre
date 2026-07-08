'use client';

// Invoicing (proposal §2.8, Sjoerd 2026-07-09): the number sequence the
// transfer-to-invoice draws from (prefix + read-only next number), the
// auto-send switch, and the VAT tariff list the opportunity popup offers.
// Same inline-save manners as the Ledger card: switches save immediately,
// text/number fields on blur/Enter; tariff rows save the whole array.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { updatePulseSettings } from './actions';
import { ERROR_CLS, INPUT_CLS, type PulseSettings, type VatTariff } from './shared';

// Mirrors the migration's seeded default — shown when settings carry none.
const DEFAULT_TARIFFS: VatTariff[] = [
  { label: 'Hoog 21%', pct: 21 },
  { label: 'Laag 9%', pct: 9 },
  { label: 'Vrijgesteld 0%', pct: 0 },
];

type TariffRow = { key: number; label: string; pct: string };
let rowSeq = 0;

export function InvoicingCard({ settings }: { settings: PulseSettings }) {
  const router = useRouter();
  const [prefix, setPrefix] = useState(settings?.invoice_prefix ?? '');
  const [autoSend, setAutoSend] = useState(settings?.invoice_auto_send ?? false);
  const [rows, setRows] = useState<TariffRow[]>(() =>
    (Array.isArray(settings?.vat_tariffs) && settings!.vat_tariffs!.length > 0
      ? settings!.vat_tariffs!
      : DEFAULT_TARIFFS
    ).map((t) => ({ key: rowSeq++, label: t.label, pct: String(t.pct) })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const nextNumber = settings?.invoice_next_number ?? 1;
  const preview = `${prefix}${String(nextNumber).padStart(4, '0')}`;

  async function save(patch: Parameters<typeof updatePulseSettings>[0]): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await updatePulseSettings(patch);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function toggleAutoSend(v: boolean) {
    setAutoSend(v); // optimistic — reverted loudly on error
    if (!(await save({ invoice_auto_send: v }))) setAutoSend(!v);
  }

  async function commitPrefix() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setPrefix(settings?.invoice_prefix ?? '');
      return;
    }
    if (prefix === (settings?.invoice_prefix ?? '')) return;
    await save({ invoice_prefix: prefix });
  }

  // Rows with a label and a valid pct make the saved list; a half-typed row
  // stays local until it's complete (so adding a row never wipes anything).
  function toTariffs(rs: TariffRow[]): VatTariff[] {
    const out: VatTariff[] = [];
    for (const r of rs) {
      const pct = parseFloat(r.pct.trim().replace(',', '.'));
      if (r.label.trim() && Number.isFinite(pct) && pct >= 0 && pct <= 100) {
        out.push({ label: r.label.trim(), pct });
      }
    }
    return out;
  }

  async function commitTariffs(rs: TariffRow[]) {
    await save({ vat_tariffs: toTariffs(rs) });
  }

  function patchRow(key: number, patch: Partial<TariffRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: number) {
    const next = rows.filter((r) => r.key !== key);
    setRows(next);
    void commitTariffs(next);
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line">
        <span className="text-sm font-semibold tracking-tight">Invoicing</span>
      </div>
      <div className="px-5 py-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3 items-end">
          <div>
            <label htmlFor="invoice-prefix" className="block text-sm font-medium mb-1">
              Number prefix
            </label>
            <input
              id="invoice-prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              onBlur={() => void commitPrefix()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  cancelledRef.current = true;
                  e.currentTarget.blur();
                }
              }}
              placeholder="e.g. 2026-"
              disabled={busy}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <span className="block text-sm font-medium mb-1">Next number</span>
            <p className="px-3 py-2 text-sm text-ink tabular-nums rounded-md bg-surface-sunken">
              {preview}
            </p>
          </div>
          <p className="text-xs text-ink-muted sm:pb-2.5">
            Assigned when an opportunity transfers to an invoice — the sequence advances by
            itself.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink">Send invoices automatically</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Every created invoice is emailed to the contact person straight away.
            </p>
          </div>
          <Switch checked={autoSend} onChange={(v) => void toggleAutoSend(v)} disabled={busy} />
        </div>

        <div className="border-t border-line pt-4">
          <p className="text-sm font-medium">VAT tariffs</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            The tariffs the income/cost popup offers — label + percentage.
          </p>
          <div className="mt-3 space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_90px_28px] gap-2 items-center">
                <input
                  value={r.label}
                  onChange={(e) => patchRow(r.key, { label: e.target.value })}
                  onBlur={() => void commitTariffs(rows)}
                  placeholder="e.g. Hoog 21%"
                  aria-label="Tariff label"
                  disabled={busy}
                  className={INPUT_CLS}
                />
                <input
                  value={r.pct}
                  onChange={(e) => patchRow(r.key, { pct: e.target.value })}
                  onBlur={() => void commitTariffs(rows)}
                  placeholder="21"
                  inputMode="decimal"
                  aria-label="Tariff percentage"
                  disabled={busy}
                  className={`${INPUT_CLS} text-right tabular-nums`}
                />
                <button
                  type="button"
                  aria-label={`Remove ${r.label || 'tariff'}`}
                  onClick={() => removeRow(r.key)}
                  disabled={busy}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
                >
                  <X size={15} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { key: rowSeq++, label: '', pct: '' }])}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-subtle hover:text-ink"
          >
            <Plus size={13} strokeWidth={2} />
            Add tariff
          </button>
        </div>

        {error && <div className={ERROR_CLS}>{error}</div>}
      </div>
    </section>
  );
}
