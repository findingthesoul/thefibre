'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { mintKey, revokeKey } from './actions';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';

export type KeyRow = {
  id: string;
  name: string | null;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function when(iso: string | null, locale: Locale) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(INTL_LOCALES[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function KeyManager({
  slug,
  keys,
  availableScopes,
  locale,
}: {
  slug: string;
  keys: KeyRow[];
  availableScopes: string[];
  locale: Locale;
}) {
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [minted, setMinted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(scope: string) {
    setChosen((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function mint() {
    setError(null);
    setMinted(null);
    start(async () => {
      const r = await mintKey(slug, name.trim(), chosen);
      if (r.error) setError(r.error);
      else {
        setMinted(r.token ?? null);
        setName('');
        setChosen([]);
        router.refresh();
      }
    });
  }

  function revoke(id: string) {
    setError(null);
    start(async () => {
      const r = await revokeKey(slug, id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  const live = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-10">
      {minted && (
        <div className="rounded-lg border border-line bg-surface-raised p-5">
          <div className="text-sm font-medium">{t(locale, 'copy_token_now')}</div>
          <p className="mt-1 text-sm text-ink-subtle">
            {t(locale, 'copy_token_msg_pre')}{' '}
            <code className="font-mono text-xs">Authorization: Bearer …</code>
            {t(locale, 'copy_token_msg_post')}
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-line bg-surface p-3 font-mono text-xs">
            {minted}
          </pre>
        </div>
      )}

      <section>
        <div className="text-sm font-medium">{t(locale, 'new_key')}</div>
        <p className="mt-1 text-sm text-ink-subtle max-w-2xl">{t(locale, 'new_key_blurb')}</p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-ink-muted">
              {t(locale, 'label_optional')}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production sync"
              className="mt-1 block w-full max-w-md rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-ink-muted">
              {t(locale, 'scopes')}
            </span>
            {availableScopes.length === 0 ? (
              <p className="mt-1 text-sm text-ink-subtle">
                {t(locale, 'no_scopes_msg')}{' '}
                <code className="font-mono text-xs">scopes_requested</code>{' '}
                {t(locale, 'no_scopes_msg_post')}
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {availableScopes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    className={
                      chosen.includes(s)
                        ? 'rounded border border-ink px-2 py-1 font-mono text-[11px]'
                        : 'rounded border border-line px-2 py-1 font-mono text-[11px] text-ink-subtle hover:text-ink'
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={mint} disabled={pending || chosen.length === 0}>
            {pending ? t(locale, 'working') : t(locale, 'mint_key')}
          </Button>
          {error && <div className="text-xs text-red-700">{error}</div>}
        </div>
      </section>

      <section>
        <div className="text-sm font-medium">{t(locale, 'active_keys')}</div>
        {live.length === 0 ? (
          <p className="mt-2 text-sm text-ink-subtle">{t(locale, 'none')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {live.map((k) => (
              <li key={k.id} className="flex items-start justify-between gap-6 p-4">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="font-medium text-sm">{k.name ?? t(locale, 'unnamed_key')}</span>
                    <span className="font-mono text-xs text-ink-muted">{k.token_prefix}…</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {k.scopes.map((s) => (
                      <span
                        key={s}
                        className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-ink-muted">
                    {t(locale, 'created')} {when(k.created_at, locale)}
                    {k.last_used_at
                      ? ` · ${t(locale, 'last_used')} ${when(k.last_used_at, locale)}`
                      : ` · ${t(locale, 'never_used')}`}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => revoke(k.id)} disabled={pending}>
                  {t(locale, 'revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 && (
        <section>
          <div className="text-sm font-medium">{t(locale, 'revoked')}</div>
          <ul className="mt-3 space-y-1">
            {revoked.map((k) => (
              <li key={k.id} className="text-sm text-ink-muted">
                <span className="font-mono text-xs">{k.token_prefix}…</span>{' '}
                {k.name ?? t(locale, 'unnamed_key')} — {t(locale, 'revoked_at')}{' '}
                {when(k.revoked_at, locale)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
