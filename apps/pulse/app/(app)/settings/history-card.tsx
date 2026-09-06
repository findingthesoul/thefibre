'use client';

// History (Sjoerd 2026-07-09: "save an image every X days/weeks... stores an
// overview of that moment... keeps it 2 years max... for comparison"): the
// cadence picker writes pulse_settings.snapshot_cadence_days (null = off);
// the API captures a workspace projection overview lazily on read when the
// last one is older than the cadence, and prunes anything past two years.
// The list below is the stored overviews; clicking one opens a compact
// read-only period table — the comparison view's first step.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { money } from '@/lib/money';
import { fetchSnapshot, updatePulseSettings } from './actions';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import {
  ERROR_CLS,
  type PulseSettings,
  type SnapshotDetail,
  type SnapshotMeta,
} from './shared';

const CADENCE_DAYS = [0, 7, 14, 30] as const;

function cadenceLabel(locale: Locale, days: number): string {
  return days === 0 ? t(locale, 'cadence_off') : t(locale, 'every_n_days', { n: days });
}

// The stored granularity is a raw value ('week' | 'fortnight' | 'month' |
// 'quarter') — map to the catalog, fall back to the raw string.
function granLabel(locale: Locale, g: string): string {
  if (g === 'week') return t(locale, 'gran_week_lc');
  if (g === 'fortnight') return t(locale, 'gran_fortnight_lc');
  if (g === 'month') return t(locale, 'gran_month_lc');
  if (g === 'quarter') return t(locale, 'gran_quarter_lc');
  return g;
}

function fmtTakenAt(locale: Locale, iso: string): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Period starts carry no time — render date-only, with the year (overviews
// live up to two years).
function fmtPeriodStart(locale: Locale, iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(INTL_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function HistoryCard({
  settings,
  snapshots,
  locale,
}: {
  settings: PulseSettings;
  snapshots: SnapshotMeta[];
  locale: Locale;
}) {
  const router = useRouter();
  const [cadence, setCadence] = useState(settings?.snapshot_cadence_days ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const currency = settings?.currency ?? 'EUR';

  async function saveCadence(days: number) {
    const prev = cadence;
    setCadence(days);
    setBusy(true);
    setError(null);
    const res = await updatePulseSettings({ snapshot_cadence_days: days === 0 ? null : days });
    setBusy(false);
    if (res.error) {
      setCadence(prev);
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-4">
        <span className="text-sm font-semibold tracking-tight">{t(locale, 'history')}</span>
        <select
          value={cadence}
          onChange={(e) => saveCadence(parseInt(e.target.value, 10))}
          disabled={busy}
          aria-label={t(locale, 'history_aria')}
          className="rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50"
        >
          {CADENCE_DAYS.map((days) => (
            <option key={days} value={days}>
              {cadenceLabel(locale, days)}
            </option>
          ))}
          {!CADENCE_DAYS.some((days) => days === cadence) && (
            <option value={cadence}>{t(locale, 'every_n_days', { n: cadence })}</option>
          )}
        </select>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-ink-muted">{t(locale, 'history_hint')}</p>
        {error && <div className={`mt-3 ${ERROR_CLS}`}>{error}</div>}
        {snapshots.length > 0 && (
          <div className="mt-4 divide-y divide-line/60 border-t border-line/60">
            {snapshots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpenId(s.id)}
                className="w-full px-1 py-2.5 flex items-center gap-4 text-left hover:bg-surface-sunken/60 transition-colors"
              >
                <span className="flex-1 text-sm text-ink hover:underline">
                  {fmtTakenAt(locale, s.taken_at)}
                </span>
                <span className="text-xs text-ink-muted">
                  {t(locale, 'per_granularity', { g: granLabel(locale, s.granularity) })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {openId && (
        <SnapshotDialog id={openId} currency={currency} locale={locale} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}

// Compact read-only popup: the stored overview's period table (start /
// committed in / out / end position). The payload is fetched on open via a
// server action — the list endpoint returns metadata only.
function SnapshotDialog({
  id,
  currency,
  locale,
  onClose,
}: {
  id: string;
  currency: string;
  locale: Locale;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch on open — the dialog unmounts on close, so once per view.
  useEffect(() => {
    let cancelled = false;
    void fetchSnapshot(id).then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) setError(res.error ?? t(locale, 'overview_not_found'));
      else setDetail(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const periods = detail?.payload?.periods ?? [];

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={
        detail
          ? `${t(locale, 'overview')} · ${fmtTakenAt(locale, detail.taken_at)}`
          : t(locale, 'overview')
      }
      description={
        detail
          ? t(locale, 'stored_per', { g: granLabel(locale, detail.granularity) })
          : undefined
      }
    >
      {error ? (
        <div className={ERROR_CLS}>{error}</div>
      ) : !detail ? (
        <p className="text-sm text-ink-muted py-2">{t(locale, 'loading')}</p>
      ) : periods.length === 0 ? (
        <p className="text-sm text-ink-muted py-2">{t(locale, 'overview_no_periods')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-muted border-b border-line">
              <th className="text-left font-medium py-2 pr-3">{t(locale, 'th_period')}</th>
              <th className="text-right font-medium py-2 px-3">{t(locale, 'th_committed_in')}</th>
              <th className="text-right font-medium py-2 px-3">{t(locale, 'tt_out')}</th>
              <th className="text-right font-medium py-2 pl-3">{t(locale, 'th_end_position')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {periods.map((p) => (
              <tr key={p.start}>
                <td className="py-2 pr-3 whitespace-nowrap">{fmtPeriodStart(locale, p.start)}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {money(p.committed_in, currency)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {money(p.expected_out, currency)}
                </td>
                <td
                  className={`py-2 pl-3 text-right tabular-nums font-medium ${
                    p.balance_expected < 0 ? 'text-red-600' : ''
                  }`}
                >
                  {money(p.balance_expected, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}
