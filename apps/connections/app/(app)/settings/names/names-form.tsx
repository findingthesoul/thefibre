'use client';

// Naming the landscape: the axes, and the bands on each one.
//
// Sjoerd, 2026-09-12: *"those six steps... not sure where they came from. Can
// they be edited?"* Then 2026-09-13: *"the whole categorisation should be
// editible. Which charatceristics and how many"* and *"And the title too"*.
// This is the answer to all three. The NAMES are yours and so is WHICH axes
// you read; what earns a band is not editable anywhere, deliberately — see
// the migration headers.
//
// Interface rules, all of them consequences of that split:
//
//   - The axis's own title sits above its bands, because it is the same kind
//     of thing: a word, with nothing computing on it.
//   - Switching an axis off hides it from the picker. It does NOT stop it
//     being worked out, which is why the control says "show" rather than
//     "use" — switching it back on tomorrow shows the whole history, not an
//     axis that starts today.
//   - The last visible axis cannot be switched off. A landscape page with no
//     landscape on it has no way back, and the control that would undo it is
//     on a different screen.
//   - The note under each band field is what EARNS the band, verbatim from
//     the landscape. You cannot sensibly name a step without being told what
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
  type AxisConfig,
  type BandLabels,
} from '../../landscape/axes';
import { saveAxisConfig, saveBandLabels } from '../actions';

export function NamesForm({
  initial,
  initialAxes,
  locale,
  canEdit,
}: {
  initial: BandLabels;
  /** Titles and visibility as the workspace last left them. Sparse. */
  initialAxes: AxisConfig;
  locale: Locale;
  /** Admins only — the RLS policy says so and the interface should not
   *  pretend otherwise by offering fields that will 403 on save. */
  canEdit: boolean;
}) {
  // Visibility is held HERE rather than inside each axis, because the rule
  // that at least one must stay visible is a rule about the set. A checkbox
  // that could only see itself would let the last one be unticked.
  const [shown, setShown] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AXES.map((a) => [a, !initialAxes[a]?.hidden])),
  );
  const lastShown = AXES.filter((a) => shown[a]).length <= 1;

  return (
    <div className="mt-8 space-y-10">
      {AXES.map((axis) => (
        <AxisNames
          key={axis}
          axis={axis}
          initial={initial[axis] ?? {}}
          initialTitle={initialAxes[axis]?.title ?? ''}
          initialShown={!initialAxes[axis]?.hidden}
          shown={shown[axis] ?? true}
          /** Unticking the only one left would strand the landscape page. */
          canHide={!(shown[axis] && lastShown)}
          onShownChange={(v) => setShown((prev) => ({ ...prev, [axis]: v }))}
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
  initialTitle,
  initialShown,
  shown,
  canHide,
  onShownChange,
  locale,
  canEdit,
}: {
  axis: Axis;
  initial: Record<string, string>;
  initialTitle: string;
  /** What visibility was when the page loaded, so Save can tell whether the
   *  switch is part of what is being saved. */
  initialShown: boolean;
  shown: boolean;
  canHide: boolean;
  onShownChange: (v: boolean) => void;
  locale: Locale;
  canEdit: boolean;
}) {
  const bands = Object.keys(BAND_KEYS[axis]);
  const notes = BAND_NOTE_KEYS[axis];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(bands.map((b) => [b, initial[b] ?? ''])),
  );
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shippedTitle = t(locale, AXIS_KEYS[axis]);
  const dirty =
    bands.some((b) => (values[b] ?? '') !== (initial[b] ?? '')) ||
    title !== initialTitle ||
    shown !== initialShown;

  function save() {
    setError(null);
    startTransition(async () => {
      // Both writes, because one Save button means one act. The axis config
      // goes first: if it fails on permission the band write would fail the
      // same way, and reporting the first refusal is clearer than reporting
      // the second.
      const a = await saveAxisConfig({ [axis]: { title, hidden: !shown } });
      if (!a.ok) {
        setError(a.error === 'forbidden' ? t(locale, 'names_forbidden') : a.error);
        return;
      }
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
    <section className={shown ? undefined : 'opacity-70'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{shippedTitle}</h2>
        <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={shown}
            disabled={!canEdit || !canHide}
            onChange={(e) => onShownChange(e.target.checked)}
          />
          {t(locale, 'names_axis_shown')}
        </label>
      </div>
      {!canHide && shown && (
        <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'names_axis_last')}</p>
      )}

      <label className="mt-3 block">
        <span className="block text-xs text-ink-subtle">{t(locale, 'names_axis_title')}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={shippedTitle}
          disabled={!canEdit}
          maxLength={80}
          className="mt-1 w-full rounded-md border border-line bg-surface py-2 px-3 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none disabled:opacity-60"
        />
      </label>

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
