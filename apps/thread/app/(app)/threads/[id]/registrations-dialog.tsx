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
  addThreadParticipant,
  type ThreadEnrolmentItem,
} from './registrations-actions';
import { one } from '@/lib/thread-types';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/switch';
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
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<ParticipantRow | null>(null);
  // Manual add — walk-ins, phone signups (Sjoerd 2026-07-04). Skips payment
  // and approval; the person lands as enrolled immediately.
  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addNotice, setAddNotice] = useState<string | null>(null);
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

  async function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!name || !email) return;
    setAddBusy(true);
    setAddNotice(null);
    setAddInfo(null);
    const r = await addThreadParticipant(threadId, {
      name,
      email,
      notify: fd.get('notify') === 'on',
    });
    if (!r.ok) {
      setAddNotice(r.error);
    } else if (r.already) {
      setAddInfo('Already enrolled — no changes made.');
    } else {
      setAdding(false);
      if (r.reactivated) {
        setAddInfo('Re-activated an earlier registration — the person is enrolled again.');
      }
      const list = await listThreadEnrolments(threadId);
      if (list.ok) setItems(list.items);
    }
    setAddBusy(false);
  }

  async function run(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    setActionError(null);
    const res = await fn(id);
    // Surface failures — silently re-rendering an unchanged list reads as
    // "it worked" (review 2026-07-05).
    if (!res.ok) setActionError(res.error ?? 'that action failed — try again');
    const r = await listThreadEnrolments(threadId);
    if (r.ok) setItems(r.items);
    setBusy(null);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Registrations"
      description="Everyone enrolled for this thread."
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
                setAdding((a) => !a);
                setAddNotice(null);
              }}
            >
              Add participant
            </Button>
            <Link
              href={`/enrolments?thread=${threadId}`}
              className="text-sm text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
            >
              Open full page →
            </Link>
          </div>
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

      {actionError && (
        <p className="mb-3 text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {actionError}
        </p>
      )}

      {adding && (
        <form
          onSubmit={submitAdd}
          className="mb-4 rounded-lg border border-line bg-surface-sunken/40 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Name" name="name" required />
            <TextField label="Email" name="email" type="email" required />
          </div>
          <SwitchField
            label="Send the confirmation email and welcome messages"
            name="notify"
            defaultChecked
          />
          {addNotice && <p className="text-sm text-red-700">{addNotice}</p>}
          {addInfo && <p className="text-sm text-ink-subtle">{addInfo}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={addBusy}>
              {addBusy ? 'Adding…' : 'Add participant'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setAddNotice(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
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

      {detail && <ParticipantDialog row={detail} onClose={() => setDetail(null)} />}

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
                      payment: PAYMENT_LABELS[it.payment_status] ?? it.payment_status,
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
                    title={`Certificate ${cert.certificate_number}`}
                  >
                    <Award size={11} strokeWidth={1.75} />
                    Certificate
                  </span>
                )}
                {/* Lifecycle actions: approve/decline while invited, mark
                    invoice payments paid, mark done → completed (+ cert). */}
                {status === 'invited' && it.payment_status !== 'pending' && (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <ActionChip
                      label="Approve"
                      Icon={Check}
                      tone="positive"
                      disabled={busy === it.id}
                      onClick={() => void run(it.id, approveEnrolment)}
                    />
                    <ActionChip
                      label="Decline"
                      Icon={X}
                      tone="negative"
                      disabled={busy === it.id}
                      onClick={() => void run(it.id, declineEnrolment)}
                    />
                  </span>
                )}
                {it.payment_status === 'pending' && (
                  <ActionChip
                    label="Mark paid"
                    Icon={BadgeEuro}
                    tone="neutral"
                    disabled={busy === it.id}
                    onClick={() => void run(it.id, markEnrolmentPaid)}
                  />
                )}
                {(status === 'enrolled' || status === 'active') &&
                  it.payment_status !== 'pending' && (
                    <ActionChip
                      label="Complete"
                      Icon={Flag}
                      tone="neutral"
                      disabled={busy === it.id}
                      onClick={() => void run(it.id, completeEnrolment)}
                    />
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
