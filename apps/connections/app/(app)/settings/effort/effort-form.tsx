'use client';

// One number per kind of work. The shipped default is the placeholder, and an
// empty field puts it back — the same rule as renaming bands, for the same
// reason: storing the default as an override would freeze it against later
// improvements to the default itself.

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import { EFFORT_KIND_KEYS } from '@/lib/effort-format';
import { saveEffortDefaults } from '../actions';
import { safely } from '@/lib/safely';

export type EffortKindRow = {
  kind: string;
  default_minutes: number;
  minutes: number | null;
  per_person: boolean;
};

const initialValue = (k: EffortKindRow) => (k.minutes === null ? '' : String(k.minutes));

export function EffortForm({
  kinds,
  locale,
  canEdit,
}: {
  kinds: EffortKindRow[];
  locale: Locale;
  canEdit: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(kinds.map((k) => [k.kind, initialValue(k)])),
  );
  const [baseline, setBaseline] = useState(values);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = kinds.some((k) => values[k.kind] !== baseline[k.kind]);
  const invalid = kinds.some((k) => {
    const v = (values[k.kind] ?? '').trim();
    if (v === '') return false;
    const n = Number(v);
    return !Number.isInteger(n) || n < 0 || n > 1440;
  });

  function save() {
    setError(null);
    // Only what changed is sent, so saving one kind never rewrites another
    // an admin colleague changed in the meantime.
    const minutes: Record<string, number | null> = {};
    for (const k of kinds) {
      if (values[k.kind] === baseline[k.kind]) continue;
      const v = (values[k.kind] ?? '').trim();
      minutes[k.kind] = v === '' ? null : Number(v);
    }
    startTransition(async () => {
      const r = await safely(
        () => saveEffortDefaults(minutes),
        (error) => ({ ok: false as const, error }),
      );
      if (r.ok) {
        setBaseline(values);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(r.error === 'forbidden' ? t(locale, 'names_forbidden') : r.error);
      }
    });
  }

  return (
    <div className="mt-8">
      <ul className="space-y-3">
        {kinds.map((k) => {
          const keys = EFFORT_KIND_KEYS[k.kind];
          return (
            <li key={k.kind} className="rounded-md border border-line bg-surface-raised px-3 py-3">
              <label className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{keys ? t(locale, keys.name) : k.kind}</span>
                  {keys && <span className="mt-0.5 block text-xs text-ink-subtle">{t(locale, keys.note)}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    inputMode="numeric"
                    value={values[k.kind] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [k.kind]: e.target.value }))}
                    placeholder={String(k.default_minutes)}
                    disabled={!canEdit}
                    className="w-20 rounded-md border border-line bg-surface px-2 py-1.5 text-right tabular-nums placeholder:text-ink-muted focus:border-line-strong focus:outline-none disabled:opacity-60"
                  />
                  <span className="text-xs text-ink-muted">
                    {t(locale, k.per_person ? 'effort_unit_per_person' : 'effort_unit')}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-ink-subtle">{t(locale, 'effort_empty_restores')}</p>

      {canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || invalid || pending}
            className="inline-flex h-8 items-center rounded-md border border-line bg-surface-raised px-3 text-sm hover:bg-surface-sunken disabled:opacity-50"
          >
            {pending ? t(locale, 'saving') : t(locale, 'save')}
          </button>
          {invalid && <span className="text-xs text-ink">{t(locale, 'effort_invalid')}</span>}
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Check size={13} /> {t(locale, 'saved')}
            </span>
          )}
          {error && <span className="text-xs text-ink">{error}</span>}
        </div>
      )}
    </div>
  );
}
