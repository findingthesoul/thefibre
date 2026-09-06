'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, toLocale, type Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n-ui';
import { Button } from '@/components/ui/button';
import { SectionLabel } from './page-chrome';
import { saveJoinPage } from './actions';

const INPUT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function JoinPageCard({
  joinPage,
  publicUrl,
  initialLocale,
  uiLocale,
}: {
  joinPage: Record<string, unknown>;
  publicUrl: string;
  /** The PUBLIC page's language (workspace-level, i18n P1). */
  initialLocale?: string | null;
  /** The signed-in interface language (user-level, i18n P3). */
  uiLocale: Locale;
}) {
  const [headline, setHeadline] = useState(
    typeof joinPage.headline === 'string' ? joinPage.headline : '',
  );
  const [intro, setIntro] = useState(typeof joinPage.intro === 'string' ? joinPage.intro : '');
  const [locale, setLocale] = useState<Locale>(toLocale(initialLocale));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await saveJoinPage(
      {
        ...joinPage,
        headline: headline.trim(),
        intro: intro.trim(),
      },
      locale,
    );
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <SectionLabel>{t(uiLocale, 'st_join_title')}</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
        {t(uiLocale, 'join_page_lives_at_before')}{' '}
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline underline-offset-2"
        >
          {publicUrl}
        </a>
        .
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3 max-w-xl">
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(uiLocale, 'headline')}</span>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={t(uiLocale, 'headline_ph')}
            className={`${INPUT} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(uiLocale, 'intro')}</span>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            placeholder={t(uiLocale, 'intro_ph')}
            className={`${INPUT} mt-1 resize-y`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(uiLocale, 'public_page_language')}</span>
          <select
            value={locale}
            onChange={(e) => setLocale(toLocale(e.target.value))}
            className={`${INPUT} mt-1`}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-muted">
            {t(uiLocale, 'public_lang_hint')}
          </span>
        </label>
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? t(uiLocale, 'saving') : t(uiLocale, 'save')}
          </Button>
          {saved && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              {t(uiLocale, 'saved')}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
