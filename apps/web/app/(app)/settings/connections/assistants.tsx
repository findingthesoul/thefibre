'use client';

// Settings → Connections → "Assistants connected to your account": every
// MCP grant the person holds, with what it may read and when it was last
// used, and one button to disconnect it. Revoking takes effect on the
// assistant's next call.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ERROR_TEXT, PILL, PILL_TONE } from '@thefibre/shared/ui/recipes';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { revokeAssistant } from './assistants-actions';

export type AssistantGrant = {
  id: string;
  client_name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  active: boolean;
};

export function AssistantsConnected({ grants, locale }: { grants: AssistantGrant[]; locale: Locale }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const df = new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium', timeStyle: 'short' });

  if (grants.length === 0) {
    return <p className="text-sm text-ink-muted">{t(locale, 'assistants_none')}</p>;
  }

  function revoke(id: string) {
    setError(null);
    start(async () => {
      const r = await revokeAssistant(id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {grants.map((g) => (
          <li key={g.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {g.client_name}{' '}
                {!g.active && <span className={`${PILL} ${PILL_TONE.neutral} ml-1`}>{t(locale, 'assistants_pending')}</span>}
              </p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {g.scopes.map((s) => t(locale, s === 'connections:read' ? 'assistants_scope_connections' : 'assistants_scope_thread')).join(' · ')}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t(locale, 'assistants_connected_on', { date: df.format(new Date(g.created_at)) })}
                {g.last_used_at ? ` · ${t(locale, 'assistants_last_used', { date: df.format(new Date(g.last_used_at)) })}` : ''}
              </p>
            </div>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => revoke(g.id)}>
              {t(locale, 'assistants_disconnect')}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}
