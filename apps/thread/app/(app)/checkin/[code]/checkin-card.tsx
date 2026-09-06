'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n-ui';
import { checkinEnrolment } from '../../threads/actions';
import type { ScannedTicket } from './page';

export function CheckinCard({ locale, ticket }: { locale: Locale; ticket: ScannedTicket }) {
  const [checkedInAt, setCheckedInAt] = useState<string | null>(ticket.checked_in_at);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(undo: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await checkinEnrolment(ticket.thread_id, ticket.id, undo);
      if (!r.ok) return setError(r.error);
      setCheckedInAt(r.checked_in_at ?? (undo ? null : new Date().toISOString()));
    });
  }

  const done = !!checkedInAt;
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wider text-ink-muted">{ticket.thread_title}</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">{ticket.person_name}</h1>
      {ticket.email && <p className="mt-1 text-sm text-ink-subtle">{ticket.email}</p>}
      <p className="mt-2 text-xs text-ink-muted">
        {ticket.status === 'invited'
          ? t(locale, 'reg_not_approved')
          : ticket.payment_status === 'pending'
            ? t(locale, 'payment_still_pending')
            : null}
      </p>

      {done ? (
        <div className="mt-6">
          <p className="inline-flex items-center gap-2 text-lg font-medium text-green-700">
            <CheckCircle2 size={22} /> {t(locale, 'checked_in')}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {new Date(checkedInAt!).toLocaleTimeString(INTL_LOCALES[locale], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4"
            leading={<Undo2 size={14} />}
            onClick={() => act(true)}
            disabled={pending}
          >
            {t(locale, 'undo')}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className="mt-6 h-14 w-full text-base"
          onClick={() => act(false)}
          disabled={pending}
        >
          {pending ? t(locale, 'checking_in') : t(locale, 'check_in')}
        </Button>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
