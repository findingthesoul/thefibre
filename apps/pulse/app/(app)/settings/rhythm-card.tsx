'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updatePulseSettings } from './actions';
import { CURRENCY_OPTIONS } from '@/lib/currencies';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { ERROR_CLS, INPUT_CLS, type PulseSettings } from './shared';

// Localized month names (1–12) and ISO weekday names (1=Mon … 7=Sun) via
// Intl — no 19 extra catalog keys for what the platform already knows.
function monthNames(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: 'long', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2026, i, 1))),
  );
}
function weekdayNames(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: 'long', timeZone: 'UTC' });
  // 2026-06-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2026, 5, 1 + i))),
  );
}

function granLabel(locale: Locale, value: string | undefined): string {
  if (value === 'week') return t(locale, 'gran_week_lc');
  if (value === 'month') return t(locale, 'gran_month_lc');
  if (value === 'fortnight') return t(locale, 'gran_fortnight_lc');
  return value ?? '';
}

export function RhythmCard({ settings, locale }: { settings: PulseSettings; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const months = monthNames(locale);
  const weekdays = weekdayNames(locale);
  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">{t(locale, 'rhythm_title')}</span>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {t(locale, 'edit')}
        </Button>
      </div>
      <dl className="px-5 py-4 grid gap-3 sm:grid-cols-2 text-sm">
        <SettingRow
          label={t(locale, 'currency')}
          value={settings?.currency ?? t(locale, 'currency_default')}
        />
        <SettingRow
          label={t(locale, 'granularity')}
          value={
            settings?.default_granularity
              ? granLabel(locale, settings.default_granularity)
              : t(locale, 'granularity_default')
          }
        />
        <SettingRow
          label={t(locale, 'fiscal_year_starts')}
          value={months[(settings?.fiscal_year_start_month ?? 1) - 1] ?? months[0]}
        />
        <SettingRow
          label={t(locale, 'how_far_ahead')}
          value={horizonLabel(locale, settings?.horizon_months ?? 12)}
        />
        <SettingRow
          label={t(locale, 'first_column_on')}
          value={weekdays[(settings?.focus_weekday ?? 0) - 1] ?? t(locale, 'today_cap')}
        />
      </dl>
      {open && <RhythmDialog settings={settings} locale={locale} onClose={() => setOpen(false)} />}
    </section>
  );
}

// Horizon presets — the projection looks this far ahead (Sjoerd 2026-07-08:
// "how far — 2, 3, 6, 12 month, 2 year"). The grid anchor is internal now
// (defaults to today; the workbook importer sets the payroll-aligned one).
const HORIZON_MONTHS = [2, 3, 6, 12, 24] as const;

function horizonLabel(locale: Locale, months: number): string {
  if (months === 24) return t(locale, 'two_years');
  return t(locale, 'n_months', { n: months });
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-ink mt-0.5">{value}</dd>
    </div>
  );
}

function RhythmDialog({
  settings,
  locale,
  onClose,
}: {
  settings: PulseSettings;
  locale: Locale;
  onClose: () => void;
}) {
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
  const months = monthNames(locale);
  const weekdays = weekdayNames(locale);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const cur = currency.trim().toUpperCase();
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
      title={t(locale, 'rhythm_title')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="rhythm-form" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="rhythm-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={INPUT_CLS}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.label} value={c.code}>
                  {c.label}
                </option>
              ))}
              {!CURRENCY_OPTIONS.some((c) => c.code === currency) && (
                <option value={currency}>{currency}</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'granularity')}</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'week' | 'fortnight' | 'month')}
              className={INPUT_CLS}
            >
              <option value="week">{t(locale, 'gran_week')}</option>
              <option value="fortnight">{t(locale, 'gran_fortnight')}</option>
              <option value="month">{t(locale, 'gran_month')}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t(locale, 'fiscal_year_starts')}
            </label>
            <select
              value={fiscalMonth}
              onChange={(e) => setFiscalMonth(parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'how_far_ahead')}</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              {HORIZON_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {horizonLabel(locale, m)}
                </option>
              ))}
              {!HORIZON_MONTHS.some((m) => m === horizon) && (
                <option value={horizon}>{t(locale, 'n_months', { n: horizon })}</option>
              )}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'first_column_on')}</label>
            <select
              value={focusWeekday}
              onChange={(e) => setFocusWeekday(parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              <option value={0}>{t(locale, 'today_cap')}</option>
              {weekdays.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-muted">{t(locale, 'first_column_hint')}</p>
          </div>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
