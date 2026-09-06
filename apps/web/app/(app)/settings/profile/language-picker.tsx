'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, isLocale, toLocale } from '@thefibre/shared';
import { saveLocale, syncLocaleCookie } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

// The Language setting (i18n P2, D1: ONE user-level language, app-wide).
//
// Lives OUTSIDE the shared ProfileForm on purpose: the shared component is
// five apps' profile face and gaining a field there is a shared-package
// change — this setting is Fibre-web's to host (the settings hubs of the
// other apps link here). Save-on-change with optimistic revert, the same
// pattern as the member-row selects.
//
// Scope: drives the emails The Fibre sends you AND (since P3) the signed-in
// interface language — the layouts read the cookie, so a save must
// router.refresh() for the chrome to repaint in the new language
// (revalidatePath alone doesn't refresh the client route — the v0.3.11
// gotcha).

const SELECT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

export function LanguagePicker({ initial, locale }: { initial: string | null; locale: Locale }) {
  const router = useRouter();
  const [value, setValue] = useState(isLocale(initial) ? initial : '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Self-heal (2026-09-06): if the cookie (what painted this page — `locale`)
  // disagrees with the profile row (`initial`, the durable copy), the cookie
  // follows the row. Runs once; never in the happy path.
  const healed = useRef(false);
  useEffect(() => {
    if (healed.current) return;
    if (toLocale(initial) === locale) return;
    healed.current = true;
    void syncLocaleCookie(initial).then((r) => {
      if (r.ok) router.refresh();
    });
  }, [initial, locale, router]);

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const r = await saveLocale(next || null);
      if (!r.ok) {
        setValue(prev);
        setError(r.error ?? t(locale, 'could_not_save'));
        return;
      }
      // The whole chrome speaks this language now — repaint it.
      router.refresh();
    });
  }

  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {t(locale, 'language')}
      </div>
      <label className="mt-3 block max-w-xs">
        <span className="text-sm text-ink-subtle">{t(locale, 'preferred_language')}</span>
        <select
          className={SELECT_CLASS}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t(locale, 'no_preference_english')}</option>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-xs text-ink-muted">{t(locale, 'language_note')}</p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
