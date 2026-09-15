'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FIELD_INPUT_CLASS } from '@thefibre/shared/ui/fields';
import { ERROR_TEXT } from '@thefibre/shared/ui/recipes';
import { t, type Locale } from '@/lib/i18n-ui';
import { connectAssistantKey, disconnectAssistantKey } from './actions';

export function KeyForm({
  locale,
  hint,
  isAdmin,
}: {
  locale: Locale;
  hint: string | null;
  isAdmin: boolean;
}) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!isAdmin) {
    return (
      <p className="text-sm text-ink-subtle">
        {hint ? t(locale, 'assistant_key_connected', { hint }) : null} {t(locale, 'assistant_key_admin_only')}
      </p>
    );
  }

  function connect() {
    setError(null);
    start(async () => {
      const r = await connectAssistantKey(key.trim());
      if (r.error) setError(r.error);
      else {
        setKey('');
        router.refresh();
      }
    });
  }

  function disconnect() {
    setError(null);
    start(async () => {
      const r = await disconnectAssistantKey();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {hint && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink">{t(locale, 'assistant_key_connected', { hint })}</p>
          <Button variant="secondary" size="sm" onClick={disconnect} disabled={pending}>
            {t(locale, 'assistant_key_remove')}
          </Button>
        </div>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          connect();
        }}
      >
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t(locale, 'assistant_key_placeholder')}
          className={`${FIELD_INPUT_CLASS} sm:max-w-md`}
        />
        <Button type="submit" variant="primary" size="md" disabled={pending || key.trim().length < 20}>
          {t(locale, 'assistant_key_connect')}
        </Button>
      </form>
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}
