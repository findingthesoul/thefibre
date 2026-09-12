'use client';

// Renaming the bands, one axis at a time.
//
// Sjoerd, 2026-09-12: *"those six steps... not sure where they came from. Can
// they be edited?"* This is the answer. The names are yours; what earns them
// is not editable anywhere, deliberately — see the migration header.
//
// Interface rules, all of them consequences of that split:
//
//   - The note under each field is what EARNS the band, verbatim from the
//     landscape. You cannot sensibly name a step without being told what
//     lands somebody on it, and asking people to hold six definitions in
//     their head while typing six words is how you get names that do not fit.
//   - A field left empty restores the shipped name. Said out loud under the
//     axis rather than hidden behind a reset button nobody finds.
//   - Save per axis, not per field and not all at once. Renaming is a
//     deliberate act on a whole vocabulary; autosaving each keystroke would
//     churn what the whole team reads while somebody is still thinking.

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import {
  AXES,
  AXIS_KEYS,
  BAND_KEYS,
  BAND_NOTE_KEYS,
  type Axis,
  type BandLabels,
} from '../../landscape/axes';
import { saveBandLabels } from '../actions';

export function NamesForm({
  initial,
  locale,
  canEdit,
}: {
  initial: BandLabels;
  locale: Locale;
  /** Admins only — the RLS policy says so and the interface should not
   *  pretend otherwise by offering fields that will 403 on save. */
  canEdit: boolean;
}) {
  return (
    <div className="mt-8 space-y-10">
      {AXES.map((axis) => (
        <AxisNames
          key={axis}
          axis={axis}
          initial={initial[axis] ?? {}}
          locale={locale}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}

function AxisNames({
  axis,
  initial,
  locale,
  canEdit,
}: {
  axis: Axis;
  initial: Record<string, string>;
  locale: Locale;
  canEdit: boolean;
}) {
  const bands = Object.keys(BAND_KEYS[axis]);
  const notes = BAND_NOTE_KEYS[axis];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(bands.map((b) => [b, initial[b] ?? ''])),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = bands.some((b) => (values[b] ?? '') !== (initial[b] ?? ''));

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveBandLabels(axis, values);
      if (r.ok) {
        setSaved(true);
        // Long enough to notice, short enough not to sit there claiming a
        // save that is now several edits old.
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(r.error === 'forbidden' ? t(locale, 'names_forbidden') : r.error);
      }
    });
  }

  return (
    <section>
      <h2 className="text-sm font-medium">{t(locale, AXIS_KEYS[axis])}</h2>

      <ul className="mt-3 space-y-3">
        {bands.map((band) => {
          const note = notes[band];
          const shipped = t(locale, BAND_KEYS[axis][band]!);
          return (
            <li key={band} className="rounded-md border border-line bg-surface-raised px-3 py-3">
              <label className="block">
                <span className="block text-xs text-ink-subtle">
                  {/* The shipped name is the placeholder AND is named here,
                      because once somebody types over it the placeholder is
                      gone and there would be no way to see what they are
                      replacing. */}
                  {shipped}
                </span>
                <input
                  value={values[band] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [band]: e.target.value }))}
                  placeholder={shipped}
                  disabled={!canEdit}
                  maxLength={80}
                  className="mt-1 w-full rounded-md border border-line bg-surface py-2 px-3 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none disabled:opacity-60"
                />
              </label>
              {note && <p className="mt-2 text-xs text-ink-subtle">{t(locale, note)}</p>}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-ink-subtle">{t(locale, 'names_empty_restores')}</p>

      {canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="inline-flex h-8 items-center rounded-md border border-line bg-surface-raised px-3 text-sm hover:bg-surface-sunken disabled:opacity-50"
          >
            {pending ? t(locale, 'saving') : t(locale, 'save')}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Check size={13} /> {t(locale, 'saved')}
            </span>
          )}
          {error && <span className="text-xs text-ink">{error}</span>}
        </div>
      )}
    </section>
  );
}
