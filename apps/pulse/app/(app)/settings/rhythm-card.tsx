'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updatePulseSettings } from './actions';
import { ERROR_CLS, INPUT_CLS, MONTH_NAMES, type PulseSettings } from './shared';

export function RhythmCard({ settings }: { settings: PulseSettings }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Time rhythm &amp; currency</span>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Edit
        </Button>
      </div>
      <dl className="px-5 py-4 grid gap-3 sm:grid-cols-2 text-sm">
        <SettingRow label="Currency" value={settings?.currency ?? 'EUR (default)'} />
        <SettingRow
          label="Granularity"
          value={settings?.default_granularity ?? 'fortnight (default)'}
        />
        <SettingRow
          label="Fiscal year starts"
          value={MONTH_NAMES[(settings?.fiscal_year_start_month ?? 1) - 1] ?? 'January'}
        />
        <SettingRow label="How far ahead" value={horizonLabel(settings?.horizon_months ?? 12)} />
        <SettingRow
          label="First column on"
          value={WEEKDAYS[(settings?.focus_weekday ?? 0) - 1] ?? 'Today'}
        />
      </dl>
      {open && <RhythmDialog settings={settings} onClose={() => setOpen(false)} />}
    </section>
  );
}

// Horizon presets — the projection looks this far ahead (Sjoerd 2026-07-08:
// "how far — 2, 3, 6, 12 month, 2 year"). The grid anchor is internal now
// (defaults to today; the workbook importer sets the payroll-aligned one).
const HORIZONS = [
  { months: 2, label: '2 months' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '12 months' },
  { months: 24, label: '2 years' },
] as const;

function horizonLabel(months: number): string {
  return HORIZONS.find((h) => h.months === months)?.label ?? `${months} months`;
}

// Focus date (Sjoerd 2026-07-09): the cashflow's first column lands on the
// next such weekday instead of today. ISO order — 1=Monday … 7=Sunday.
const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-ink mt-0.5">{value}</dd>
    </div>
  );
}

function RhythmDialog({ settings, onClose }: { settings: PulseSettings; onClose: () => void }) {
  const router = useRouter();
  const [currency, setCurrency] = useState(settings?.currency ?? 'EUR');
  const [granularity, setGranularity] = useState<'week' | 'fortnight' | 'month'>(
    (['week', 'fortnight', 'month'] as const).find((g) => g === settings?.default_granularity) ??
      'fortnight',
  );
  const [fiscalMonth, setFiscalMonth] = useState(settings?.fiscal_year_start_month ?? 1);
  const [horizon, setHorizon] = useState(settings?.horizon_months ?? 12);
  // 0 = Today (stored as null); 1–7 = ISO weekday.
  const [focusWeekday, setFocusWeekday] = useState(settings?.focus_weekday ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const cur = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) {
      setError('Currency must be a 3-letter code (e.g. EUR).');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await updatePulseSettings({
      currency: cur,
      default_granularity: granularity,
      fiscal_year_start_month: fiscalMonth,
      horizon_months: horizon,
      focus_weekday: focusWeekday === 0 ? null : focusWeekday,
    });
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
      title="Time rhythm & currency"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="rhythm-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="rhythm-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="EUR"
              className={`${INPUT_CLS} uppercase`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Granularity</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'week' | 'fortnight' | 'month')}
              className={INPUT_CLS}
            >
              <option value="week">Week</option>
              <option value="fortnight">Fortnight</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fiscal year starts</label>
            <select
              value={fiscalMonth}
              onChange={(e) => setFiscalMonth(parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">How far ahead</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              {HORIZONS.map((h) => (
                <option key={h.months} value={h.months}>
                  {h.label}
                </option>
              ))}
              {!HORIZONS.some((h) => h.months === horizon) && (
                <option value={horizon}>{horizon} months</option>
              )}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First column on</label>
            <select
              value={focusWeekday}
              onChange={(e) => setFocusWeekday(parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              <option value={0}>Today</option>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-muted">
              The cashflow starts on the next such weekday instead of today.
            </p>
          </div>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
