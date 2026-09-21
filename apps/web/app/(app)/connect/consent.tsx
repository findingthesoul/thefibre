'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ERROR_TEXT } from '@thefibre/shared/ui/recipes';
import { t, type Locale } from '@/lib/i18n-ui';
import { decideConsent, type ConsentParams } from './actions';

export function ConsentButtons({ params, locale }: { params: ConsentParams; locale: Locale }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function decide(decision: 'approve' | 'deny') {
    setError(null);
    start(async () => {
      const r = await decideConsent(params, decision);
      if (r.error || !r.redirect) {
        setError(r.error ?? t(locale, 'connect_failed'));
        return;
      }
      // The API built this URL from the client's REGISTERED redirect_uri;
      // the browser goes exactly there and nowhere else.
      window.location.assign(r.redirect);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="md" disabled={pending} onClick={() => decide('deny')}>
          {t(locale, 'connect_deny')}
        </Button>
        <Button variant="primary" size="md" disabled={pending} onClick={() => decide('approve')}>
          {t(locale, 'connect_approve')}
        </Button>
      </div>
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}
