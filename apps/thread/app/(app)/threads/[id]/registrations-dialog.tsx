'use client';

// Registrations popup — everyone enrolled for THIS thread, without leaving
// the timeline. Rows open the participant detail popup; the footer offers
// manual add (walk-ins) and links to /enrolments for bulk actions.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, Check, X, Flag, BadgeEuro, UserPlus } from 'lucide-react';
import {
  listThreadEnrolments,
  approveEnrolment,
  declineEnrolment,
  completeEnrolment,
  markEnrolmentPaid,
  type ThreadEnrolmentItem,
} from './registrations-actions';
import { AddParticipantDialog } from './add-participant-dialog';
import { one } from '@/lib/thread-types';
import type { Locale } from '@thefibre/shared';
import { t, enrolStatusLabel, type UiKey } from '@/lib/i18n-ui';
import { Dialog } from '@/components/ui/dialog';
import {
  ParticipantDialog,
  type ParticipantRow,
} from '../../enrolments/participant-dialog';
import { Button } from '@/components/ui/button';

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-surface-sunken text-ink-subtle ring-line',
  enrolled: 'bg-sky-50 text-sky-700 ring-sky-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  dropped: 'bg-surface-sunken text-ink-muted ring-line',
};

const PAYMENT_KEYS: Record<string, UiKey> = {
  not_required: 'free',
  pending: 'pay_pending',
  paid: 'pay_paid',
  refunded: 'pay_refunded',
  failed: 'pay_failed',
};

export function RegistrationsDialog({
  locale,
  threadId,
  onClose,
}: {
  locale: Locale;
  threadId: string;
  onClose: () => void;
}) {
  const paymentLabel = (status: string) =>
    PAYMENT_KEYS[status] ? t(locale, PAYMENT_KEYS[status]) : status;
  const [items, setItems] = useState<ThreadEnrolmentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<ParticipantRow | null>(null);
  // Manual add — walk-ins, phone signups (Sjoerd 2026-07-04). Lives in its
  // own popup since the billing choice landed (paid threads invoice by
  // default — Sjoerd 2026-09-05).
  const [adding, setAdding] = useState(false);
  const [addInfo, setAddInfo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function run(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    setActionError(null);
    const res = await fn(id);
    // Surface failures — silently re-rendering an unchanged list reads as
    // "it worked" (review 2026-07-05).
    if (!res.ok) setActionError(res.error ?? t(locale, 'action_failed'));
    const r = await listThreadEnrolments(threadId);
    if (r.ok) setItems(r.items);
    setBusy(null);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'registrations')}
      description={t(locale, 'registrations_desc')}
      size="lg"
      footer={
        <>
          <div className="mr-auto flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leading={<UserPlus size={14} />}
              onClick={() => {
                setAdding(true);
                setAddInfo(null);
              }}
            >
              {t(locale, 'add_participant')}
            </Button>
            <Link
              href={`/enrolments?thread=${threadId}`}
              className="text-sm text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
            >
              {t(locale, 'open_full_page')}
            </Link>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'close')}
          </Button>
        </>
      }
    >
      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {t(locale, 'couldnt_load', { error })}
        </p>
      )}

      {actionError && (
        <p className="mb-3 text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {actionError}
        </p>
      )}

      {addInfo && (
        <p className="mb-3 text-sm text-ink-subtle border border-line bg-surface-sunken/40 rounded-md px-3 py-2">
          {addInfo}
        </p>
      )}

      {adding && (
        <AddParticipantDialog
          locale={locale}
          threadId={threadId}
          onClose={() => setAdding(false)}
          onAdded={(info) => {
            setAddInfo(info);
            void listThreadEnrolments(threadId).then((r) => {
              if (r.ok) setItems(r.items);
            });
          }}
        />
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
        <p className="text-sm text-ink-subtle py-4">{t(locale, 'no_registrations')}</p>
      )}

      {detail && <ParticipantDialog locale={locale} row={detail} onClose={() => setDetail(null)} />}

      {items !== null && items.length > 0 && (
        <ul className="divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {items.map((it) => {
            const person = one(it.person);
            const enr = one(it.enrolment);
            const cert = one(it.certificate);
            const name =
              [person?.first_name, person?.last_name].filter(Boolean).join(' ') ||
              person?.email ||
              t(locale, 'unknown');
            const status = enr?.status ?? 'enrolled';
            return (
              <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setDetail({
                      id: it.id,
                      name,
                      email: person?.email ?? null,
                      contact: {
                        phone: person?.phone ?? null,
                        city: person?.city ?? null,
                        country: person?.country ?? null,
                        preferredLanguage: person?.preferred_language ?? null,
                      },
                      threadId: it.thread_id,
                      threadTitle: null,
                      certNumber: cert?.certificate_number ?? null,
                      payment: paymentLabel(it.payment_status),
                      status,
                      detail: {
                        answers: it.answers ?? null,
                        billing: it.billing ?? null,
                        amountCents: it.amount_cents,
                        currency: it.currency,
                        method: it.stripe_session_id ? 'stripe' : it.amount_cents ? 'invoice' : null,
                        ticketName: one(it.ticket ?? null)?.name ?? null,
                        couponCode: one(it.coupon ?? null)?.code ?? null,
                        enrolledAt: enr?.enrolled_at ?? null,
                        completedAt: enr?.completed_at ?? null,
                        progressPct: enr?.progress_pct ?? 0,
                        createdAt: it.created_at,
                        paymentStatus: it.payment_status,
                      },
                    })
                  }
                  className="min-w-0 flex-1 text-left rounded-md -mx-1 px-1 hover:bg-surface-sunken/60 transition-colors"
                >
                  <div className="text-sm font-medium truncate">{name}</div>
                  {person?.email && (
                    <div className="text-xs text-ink-subtle mt-0.5 truncate">{person.email}</div>
                  )}
                </button>
                {cert && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ring-1 ring-yellow-300 bg-yellow-50 text-ink shrink-0"
                    title={`${t(locale, 'certificate')} ${cert.certificate_number}`}
                  >
                    <Award size={11} strokeWidth={1.75} />
                    {t(locale, 'certificate')}
                  </span>
                )}
                {/* Lifecycle actions: approve/decline while invited, mark
                    invoice payments paid, mark done → completed (+ cert). */}
                {status === 'invited' && it.payment_status !== 'pending' && (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <ActionChip
                      label={t(locale, 'approve')}
                      Icon={Check}
                      tone="positive"
                      disabled={busy === it.id}
                      onClick={() => void run(it.id, approveEnrolment)}
                    />
                    <ActionChip
                      label={t(locale, 'decline')}
                      Icon={X}
                      tone="negative"
                      disabled={busy === it.id}
                      onClick={() => void run(it.id, declineEnrolment)}
                    />
                  </span>
                )}
                {it.payment_status === 'pending' && (
                  <ActionChip
                    label={t(locale, 'mark_paid')}
                    Icon={BadgeEuro}
                    tone="neutral"
                    disabled={busy === it.id}
                    onClick={() => void run(it.id, markEnrolmentPaid)}
                  />
                )}
                {(status === 'enrolled' || status === 'active') &&
                  it.payment_status !== 'pending' && (
                    <ActionChip
                      label={t(locale, 'complete')}
                      Icon={Flag}
                      tone="neutral"
                      disabled={busy === it.id}
                      onClick={() => void run(it.id, completeEnrolment)}
                    />
                  )}
                <span className="text-xs text-ink-muted shrink-0">
                  {paymentLabel(it.payment_status)}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ring-1 shrink-0 ${
                    STATUS_STYLES[status] ?? STATUS_STYLES.enrolled
                  }`}
                >
                  {enrolStatusLabel(locale, status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

const CHIP_TONES: Record<string, string> = {
  positive: 'ring-emerald-200 bg-emerald-50 text-emerald-700 hover:ring-emerald-300',
  negative: 'ring-red-200 bg-red-50 text-red-700 hover:ring-red-300',
  neutral: 'ring-line bg-surface-raised text-ink-subtle hover:text-ink hover:ring-line-strong',
};

function ActionChip({
  label,
  Icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  Icon: typeof Check;
  tone: 'positive' | 'negative' | 'neutral';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ring-1 transition-colors disabled:opacity-50 shrink-0 ${CHIP_TONES[tone]}`}
    >
      <Icon size={11} strokeWidth={1.75} />
      {label}
    </button>
  );
}
