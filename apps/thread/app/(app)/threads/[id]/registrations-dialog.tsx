'use client';

// Registrations popup — everyone enrolled for THIS thread, without leaving
// the timeline. Read-only list; the footer links to the full /enrolments
// page (filtered) for certificate issuing and bulk actions.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { listThreadEnrolments, type ThreadEnrolmentItem } from './registrations-actions';
import { one } from '@/lib/thread-types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-surface-sunken text-ink-subtle ring-line',
  enrolled: 'bg-sky-50 text-sky-700 ring-sky-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  dropped: 'bg-surface-sunken text-ink-muted ring-line',
};

const PAYMENT_LABELS: Record<string, string> = {
  not_required: 'Free',
  pending: 'Payment pending',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

export function RegistrationsDialog({
  threadId,
  onClose,
}: {
  threadId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ThreadEnrolmentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await listThreadEnrolments(threadId);
      if (cancelled) return;
      if (r.ok) setItems(r.items);
      else setError(r.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Registrations"
      description="Everyone enrolled for this thread."
      size="lg"
      footer={
        <>
          <Link
            href={`/enrolments?thread=${threadId}`}
            className="mr-auto text-sm text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
          >
            Open full page →
          </Link>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          Couldn&apos;t load registrations: {error}
        </p>
      )}

      {!error && items === null && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-line bg-surface-sunken/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <p className="text-sm text-ink-subtle py-4">
          No registrations yet — publish the thread and share its public page.
        </p>
      )}

      {items !== null && items.length > 0 && (
        <ul className="divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {items.map((it) => {
            const person = one(it.person);
            const enr = one(it.enrolment);
            const cert = one(it.certificate);
            const name =
              [person?.first_name, person?.last_name].filter(Boolean).join(' ') ||
              person?.email ||
              'Unknown';
            const status = enr?.status ?? 'enrolled';
            return (
              <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{name}</div>
                  {person?.email && (
                    <div className="text-xs text-ink-subtle mt-0.5 truncate">{person.email}</div>
                  )}
                </div>
                {cert && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ring-1 ring-yellow-300 bg-yellow-50 text-ink shrink-0"
                    title={`Certificate ${cert.certificate_number}`}
                  >
                    <Award size={11} strokeWidth={1.75} />
                    Certificate
                  </span>
                )}
                <span className="text-xs text-ink-muted shrink-0">
                  {PAYMENT_LABELS[it.payment_status] ?? it.payment_status}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                    STATUS_STYLES[status] ?? STATUS_STYLES.enrolled
                  }`}
                >
                  {status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
