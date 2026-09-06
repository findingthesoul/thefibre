'use client';

// THE workspace currency editor — platform-wide setting (Sjoerd,
// 2026-09-05: "currency should be a platform-wide setting… a module").
// Lives in The Fibre's Settings → Currencies; apps link there via the
// settings canon. The save is injected (the shared package never imports
// an app's lib): a server action that PATCHes /api/v1/workspace.
//
// Rates, when provided, are the ECB daily reference rates — indicative
// display only. Charging never converts: a thing priced in ZAR charges in
// ZAR; conversion is information for the human reading the number.

import { useState } from 'react';
import { X } from 'lucide-react';
import { chromeT, useLocale } from './i18n-ui.js';

const INPUT =
  'rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export type EcbRates = { base: string; date: string; rates: Record<string, number> };

export function CurrencyEditor({
  defaultCurrency,
  currencies,
  onSave,
  rates,
}: {
  defaultCurrency: string;
  currencies: string[];
  /** Persists via the app's server action; resolves to an error string or null. */
  onSave: (input: { default_currency: string; currencies: string[] }) => Promise<string | null>;
  /** ECB daily reference rates for indicative display; omit to hide. */
  rates?: EcbRates | null;
}) {
  const locale = useLocale();
  const [list, setList] = useState<string[]>(currencies);
  const [def, setDef] = useState(defaultCurrency);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function add() {
    const code = adding.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      setError(chromeT(locale, 'currency_code_error'));
      return;
    }
    setError(null);
    if (!list.includes(code)) setList([...list, code]);
    setAdding('');
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const err = await onSave({ default_currency: def, currencies: list });
    setBusy(false);
    if (err) setError(err);
    else setSaved(true);
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <p className="text-sm text-ink-muted">{chromeT(locale, 'currencies_intro')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {list.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink"
          >
            {c}
            {c !== def && (
              <button
                type="button"
                onClick={() => setList(list.filter((x) => x !== c))}
                className="text-ink-muted hover:text-ink"
                aria-label={chromeT(locale, 'remove_item', { name: c })}
              >
                <X size={13} />
              </button>
            )}
          </span>
        ))}
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={chromeT(locale, 'add_currency_placeholder')}
          maxLength={3}
          className={`${INPUT} w-28 uppercase`}
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken"
        >
          {chromeT(locale, 'add')}
        </button>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">
          {chromeT(locale, 'default_currency')}
        </label>
        <select value={def} onChange={(e) => setDef(e.target.value)} className={`${INPUT} w-32`}>
          {list.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {rates && list.length > 1 && (
        <div className="mt-4 rounded-md border border-line bg-surface-sunken px-3 py-2 text-xs text-ink-subtle">
          <span className="font-medium text-ink">{chromeT(locale, 'ecb_rates')}</span> ({rates.date}): 1{' '}
          {rates.base} ={' '}
          {list
            .filter((c) => c !== rates.base && rates.rates[c])
            .map((c) => `${rates.rates[c]} ${c}`)
            .join(' · ') || '—'}
          <span className="block mt-0.5 text-ink-muted">
            {chromeT(locale, 'indicative_only')}
          </span>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-3 text-sm text-ink-muted">{chromeT(locale, 'saved')}</p>}
      <div className="mt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-ink text-ink-inverse px-3.5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? chromeT(locale, 'saving') : chromeT(locale, 'save_currencies')}
        </button>
      </div>
    </section>
  );
}
