'use client';

// The VAT rate editor — rates as data, updated when the law updates
// (Sjoerd, 2026-09-04: "a VAT module so we can update it regularly").
// Stripe Tax computes on card rails; THIS table governs everything else
// and is the platform's own reference.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { saveVat, type VatConfig } from './actions';

export function VatEditor({ initial }: { initial: VatConfig }) {
  const [config, setConfig] = useState<VatConfig>(initial);
  const [newCountry, setNewCountry] = useState('');
  const [newRate, setNewRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const countries = Object.keys(config.rates).sort();
  const dirty = JSON.stringify(config) !== JSON.stringify(initial);

  function setRate(cc: string, v: string) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 50) return;
    setSaved(false);
    setConfig((c) => ({ ...c, rates: { ...c.rates, [cc]: n } }));
  }

  function removeCountry(cc: string) {
    if (cc === config.home_country) return;
    setSaved(false);
    setConfig((c) => {
      const rates = { ...c.rates };
      delete rates[cc];
      return { ...c, rates };
    });
  }

  function addCountry() {
    const cc = newCountry.trim().toUpperCase();
    const n = Number(newRate);
    if (!/^[A-Z]{2}$/.test(cc) || !Number.isFinite(n) || n < 0 || n > 50) {
      setError('Country code (2 letters) and a rate 0–50.');
      return;
    }
    setError(null);
    setSaved(false);
    setConfig((c) => ({ ...c, rates: { ...c.rates, [cc]: n } }));
    setNewCountry('');
    setNewRate('');
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await saveVat(config);
      if (r.error) setError(r.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const input =
    'h-8 rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-line-strong';

  return (
    <div>
      <div className="flex min-h-9 items-center justify-between gap-4">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={config.eu_b2b_reverse_charge}
            onChange={(e) => {
              setSaved(false);
              setConfig((c) => ({ ...c, eu_b2b_reverse_charge: e.target.checked }));
            }}
            className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
          />
          <span>
            Reverse-charge EU businesses with a VAT number{' '}
            <span className="text-ink-muted">(0% + &ldquo;VAT reverse-charged&rdquo; on the invoice)</span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-700">{error}</span>}
          {saved && !dirty && <span className="text-xs text-ink-muted">Saved.</span>}
          {dirty && (
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save rates'}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="px-4 py-2.5 font-normal">Country</th>
              <th className="px-4 py-2.5 font-normal">Standard rate %</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {countries.map((cc) => (
              <tr key={cc} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2">
                  <span className="font-mono">{cc}</span>
                  {cc === config.home_country && (
                    <span className="ml-2 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-900">
                      Home
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    value={config.rates[cc]}
                    onChange={(e) => setRate(cc, e.target.value)}
                    className={`${input} w-24`}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  {cc !== config.home_country && (
                    <button
                      type="button"
                      onClick={() => removeCountry(cc)}
                      className="text-xs text-ink-muted hover:text-ink"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={newCountry}
          onChange={(e) => setNewCountry(e.target.value)}
          placeholder="CC"
          maxLength={2}
          className={`${input} w-16 uppercase`}
        />
        <input
          value={newRate}
          onChange={(e) => setNewRate(e.target.value)}
          placeholder="rate %"
          inputMode="decimal"
          className={`${input} w-24`}
        />
        <Button variant="secondary" size="sm" onClick={addCountry} disabled={pending}>
          Add country
        </Button>
      </div>
    </div>
  );
}
