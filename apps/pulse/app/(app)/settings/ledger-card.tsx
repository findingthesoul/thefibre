'use client';

// P4 opt-in (Sjoerd 2026-07-08: "add invoices to the sales pipeline...
// based on payment moments of Stripe settings"): open purchase-ledger rows
// (Stripe/invoice money events from Meet + The Thread) project as
// receivables, expected to settle `ledger_terms_days` after creation.
// Inline card — the switch saves immediately, the days input on blur/Enter.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { updatePulseSettings } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';
import { ERROR_CLS, type PulseSettings } from './shared';

export function LedgerCard({ settings, locale }: { settings: PulseSettings; locale: Locale }) {
  const router = useRouter();
  const [include, setInclude] = useState(settings?.include_ledger ?? false);
  const [days, setDays] = useState(String(settings?.ledger_terms_days ?? 14));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  async function save(patch: { include_ledger?: boolean; ledger_terms_days?: number }) {
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

  async function toggle(v: boolean) {
    setInclude(v); // optimistic — reverted loudly on error
    if (!(await save({ include_ledger: v }))) setInclude(!v);
  }

  async function commitDays() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDays(String(settings?.ledger_terms_days ?? 14));
      return;
    }
    const n = parseInt(days.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 120) {
      setError(t(locale, 'settlement_range_error'));
      return;
    }
    if (n === (settings?.ledger_terms_days ?? 14)) return;
    await save({ ledger_terms_days: n });
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line">
        <span className="text-sm font-semibold tracking-tight">{t(locale, 'ledger_invoices')}</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink">{t(locale, 'include_in_cashflow')}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'ledger_hint')}</p>
          </div>
          <Switch
            checked={include}
            onChange={(v) => void toggle(v)}
            disabled={busy}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="ledger-terms-days" className="text-sm text-ink">
            {t(locale, 'expected_settlement_days')}
          </label>
          <input
            id="ledger-terms-days"
            type="number"
            min={0}
            max={120}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onBlur={() => void commitDays()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                cancelledRef.current = true;
                e.currentTarget.blur();
              }
            }}
            disabled={busy}
            className="w-24 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-60"
          />
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </div>
    </section>
  );
}
