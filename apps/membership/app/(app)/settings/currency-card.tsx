'use client';

// Workspace-level currency SPoT — this card writes the PLATFORM's
// /workspace endpoint, not membership settings: one list of currencies for
// everything the workspace prices, Membership tiers first.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionLabel } from './page-chrome';
import { saveCurrencies } from './actions';

const INPUT =
  'rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function CurrencyCard({
  defaultCurrency,
  currencies,
}: {
  defaultCurrency: string;
  currencies: string[];
}) {
  const [list, setList] = useState<string[]>(currencies);
  const [def, setDef] = useState(defaultCurrency);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function add() {
    const code = adding.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      setError('A currency is a 3-letter code, e.g. USD.');
      return;
    }
    setError(null);
    if (!list.includes(code)) setList([...list, code]);
    setAdding('');
  }

  function remove(code: string) {
    if (code === def) return; // the default can't be removed
    setList(list.filter((c) => c !== code));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await saveCurrencies({ default_currency: def, currencies: list });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <SectionLabel>Currencies</SectionLabel>
      <p className="mt-1 text-sm text-ink-muted">
        The currencies this workspace sells in — one list for the whole workspace. Each tier and
        product is priced in one of them; existing prices keep their currency when the list
        changes.
      </p>
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
                onClick={() => remove(c)}
                className="text-ink-muted hover:text-ink"
                aria-label={`Remove ${c}`}
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
          placeholder="Add (e.g. USD)"
          maxLength={3}
          className={`${INPUT} w-28 uppercase`}
        />
        <Button type="button" variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">Default currency</label>
        <select value={def} onChange={(e) => setDef(e.target.value)} className={`${INPUT} w-32`}>
          {list.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-3 text-sm text-ink-muted">Saved.</p>}
      <div className="mt-4">
        <Button type="button" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save currencies'}
        </Button>
      </div>
    </section>
  );
}
