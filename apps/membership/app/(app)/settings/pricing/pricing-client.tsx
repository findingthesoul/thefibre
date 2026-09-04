'use client';

// Rule rows: WHEN <attribute> <is/is not one of> <values> THEN price = <pct>%.
// The attribute vocabulary is deploy-time (country, billing interval today);
// adding one is a code change, composing rules from them is the workspace's.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';
import { COUNTRIES } from '@thefibre/shared/countries';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { Button } from '@/components/ui/button';
import { savePricingRules } from './actions';

export type PriceRule = {
  when: { attr: 'country' | 'interval'; op: 'in' | 'not_in'; values: string[] };
  pct: number;
  label?: string;
};
export type PriceLogic = { rules: PriceRule[]; default_pct: number };
export type PricingRuleRow = { id: string; tier_id: string | null; config: PriceLogic };

const INPUT =
  'rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name, hint: c.code }));

export function PricingRulesClient({ initial }: { initial: PriceLogic | null }) {
  const router = useRouter();
  const [rules, setRules] = useState<PriceRule[]>(initial?.rules ?? []);
  const [defaultPct, setDefaultPct] = useState(String(initial?.default_pct ?? 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patchRule(i: number, patch: Partial<PriceRule>) {
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function patchWhen(i: number, patch: Partial<PriceRule['when']>) {
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, when: { ...r.when, ...patch } } : r)));
  }

  async function save() {
    const bad = rules.find((r) => r.when.values.length === 0);
    if (bad) {
      setError('Every rule needs at least one value — pick countries (or remove the row).');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await savePricingRules({
      rules: rules.map((x) => ({ ...x, pct: Math.round(x.pct) })),
      default_pct: Math.max(1, Math.min(1000, parseInt(defaultPct, 10) || 100)),
    });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {rules.length === 0 && (
        <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
          No rules yet. Example: <em>when country is one of South Africa → price 75%</em>. Members
          declare their country on the join page; the matching rule sets their price.
        </p>
      )}

      {rules.map((rule, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface-raised p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">when</span>
            <select
              value={rule.when.attr}
              onChange={(e) =>
                patchWhen(i, { attr: e.target.value as 'country' | 'interval', values: [] })
              }
              className={INPUT}
            >
              <option value="country">country</option>
              <option value="interval">billing interval</option>
            </select>
            <select
              value={rule.when.op}
              onChange={(e) => patchWhen(i, { op: e.target.value as 'in' | 'not_in' })}
              className={INPUT}
            >
              <option value="in">is one of</option>
              <option value="not_in">is not one of</option>
            </select>
            <span className="text-ink-muted">→ price</span>
            <input
              value={String(rule.pct)}
              onChange={(e) => patchRule(i, { pct: parseInt(e.target.value, 10) || 0 })}
              inputMode="numeric"
              className={`${INPUT} w-20 text-right`}
            />
            <span className="text-ink-muted">%</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove rule"
              className="ml-auto"
              onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </Button>
          </div>

          <div className="mt-3">
            {rule.when.attr === 'country' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {rule.when.values.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink"
                  >
                    {COUNTRIES.find((c) => c.code === code)?.name ?? code}
                    <button
                      type="button"
                      className="text-ink-muted hover:text-ink"
                      onClick={() =>
                        patchWhen(i, { values: rule.when.values.filter((v) => v !== code) })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
                <SearchSelect
                  value=""
                  onChange={(code) => {
                    if (code && !rule.when.values.includes(code)) {
                      patchWhen(i, { values: [...rule.when.values, code] });
                    }
                  }}
                  options={COUNTRY_OPTIONS.filter((o) => !rule.when.values.includes(o.value))}
                  placeholder="Add a country…"
                  className="w-56"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                {(['year', 'month'] as const).map((iv) => (
                  <label key={iv} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-ink"
                      checked={rule.when.values.includes(iv)}
                      onChange={(e) =>
                        patchWhen(i, {
                          values: e.target.checked
                            ? [...rule.when.values, iv]
                            : rule.when.values.filter((v) => v !== iv),
                        })
                      }
                    />
                    {iv === 'year' ? 'Yearly' : 'Monthly'}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        leading={<Plus size={15} strokeWidth={2} />}
        onClick={() =>
          setRules((prev) => [
            ...prev,
            { when: { attr: 'country', op: 'in', values: [] }, pct: 100 },
          ])
        }
      >
        Add rule
      </Button>

      <div className="flex items-center gap-2 text-sm pt-2 border-t border-line">
        <span className="text-ink-muted">When no rule matches → price</span>
        <input
          value={defaultPct}
          onChange={(e) => setDefaultPct(e.target.value)}
          inputMode="numeric"
          className={`${INPUT} w-20 text-right`}
        />
        <span className="text-ink-muted">%</span>
      </div>

      <p className="text-xs text-ink-muted">
        Country is self-declared on the join page — never guessed from an IP. A member&apos;s
        country change reprices from their next renewal. A card issued in a different country
        than declared sends the admins a heads-up, never blocks.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-ink-muted">Saved.</p>}
      <Button type="button" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save pricing rules'}
      </Button>
    </div>
  );
}
