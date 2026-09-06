'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { SectionLabel } from './page-chrome';
import { saveCircle } from './actions';

const INPUT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function CircleCard({
  communityUrl,
  tokenSet,
  locale,
}: {
  communityUrl: string | null;
  tokenSet: boolean;
  locale: Locale;
}) {
  const [url, setUrl] = useState(communityUrl ?? '');
  // Empty string = untouched (keep the stored token). The API only ever says
  // whether a token exists — the value itself never leaves it.
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save(removeToken = false) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await saveCircle({
      circle_community_url: url.trim() || null,
      ...(removeToken
        ? { circle_api_token: null }
        : token.trim()
          ? { circle_api_token: token.trim() }
          : {}),
    });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setToken('');
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <SectionLabel>Circle</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">{t(locale, 'circle_blurb')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="mt-4 space-y-3 max-w-xl"
      >
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'community_url')}</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            placeholder="https://your-community.circle.so"
            className={`${INPUT} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'api_token')}</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            autoComplete="off"
            placeholder={tokenSet ? t(locale, 'token_saved_ph') : t(locale, 'paste_token_ph')}
            className={`${INPUT} mt-1`}
          />
        </label>
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
          {tokenSet && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void save(true)}
            >
              {t(locale, 'remove_token')}
            </Button>
          )}
          {saved && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              {t(locale, 'saved')}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
