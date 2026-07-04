'use client';

// The participant detail popup — everything about one enrolment, shared by
// the Enrolments page and the per-thread Registrations popup.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { resendReceiptForEnrolment } from '../threads/actions';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type EnrolmentDetail = {
  answers: Record<string, unknown> | null;
  billing: { company?: string; address?: string; postal_code?: string; city?: string; country?: string; tax_no?: string } | null;
  amountCents: number | null;
  currency: string | null;
  method: 'stripe' | 'invoice' | null;
  ticketName: string | null;
  couponCode: string | null;
  enrolledAt: string | null;
  completedAt: string | null;
  progressPct: number;
  createdAt: string;
  paymentStatus: string;
};

export type ParticipantContact = {
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  preferredLanguage?: string | null;
};

export type ParticipantRow = {
  id: string;
  name: string;
  email: string | null;
  contact?: ParticipantContact | null;
  threadId: string | null;
  threadTitle: string | null;
  certNumber: string | null;
  payment: string;
  status: string;
  detail: EnrolmentDetail;
};

const THREAD_HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

function fmtMoney(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** answers keys derive from question labels (snake_case) — prettify back. */
function prettyKey(k: string): string {
  const words = k.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Everything we know about one participant's enrolment — including the
// registration answers, which are collected but were shown nowhere before.
export function ParticipantDialog({
  row,
  onClose,
}: {
  row: ParticipantRow;
  onClose: () => void;
}) {
  const d = row.detail;
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const answers = Object.entries(d.answers ?? {}).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined,
  );
  const hasPurchase = d.amountCents != null || d.couponCode != null;
  const contactBits = [
    row.contact?.phone,
    [row.contact?.city, row.contact?.country].filter(Boolean).join(', ') || null,
    row.contact?.preferredLanguage ? `Speaks ${row.contact.preferredLanguage}` : null,
  ].filter(Boolean) as string[];
  return (
    <Dialog
      open
      onClose={onClose}
      title={row.name}
      description={row.email ?? undefined}
      size="lg"
      footer={
        <>
          <div className="mr-auto flex items-center gap-2">
            {row.threadId && (
              <Link
                href={`/threads/${row.threadId}`}
                className="text-sm text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
              >
                Open thread →
              </Link>
            )}
            {hasPurchase && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Mail size={14} />}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setNotice(null);
                    const r = await resendReceiptForEnrolment(row.id);
                    setNotice(r.ok ? 'Receipt sent.' : r.error);
                  })
                }
              >
                {pending ? 'Sending…' : 'Send receipt'}
              </Button>
            )}
            {notice && <span className="text-xs text-ink-muted">{notice}</span>}
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        <section className="space-y-2">
          {(row.email || contactBits.length > 0) && (
            <DetailRow label="Contact">
              {[row.email, ...contactBits].filter(Boolean).join(' · ')}
            </DetailRow>
          )}
          <DetailRow label="Thread">{row.threadTitle ?? '—'}</DetailRow>
          <DetailRow label="Status">
            <span className="capitalize">{row.status}</span>
            {d.progressPct > 0 && ` · ${d.progressPct}% progress`}
          </DetailRow>
          <DetailRow label="Signed up">{fmtDate(d.createdAt)}</DetailRow>
          {d.enrolledAt && <DetailRow label="Enrolled">{fmtDate(d.enrolledAt)}</DetailRow>}
          {d.completedAt && <DetailRow label="Completed">{fmtDate(d.completedAt)}</DetailRow>}
          {row.certNumber && (
            <DetailRow label="Certificate">
              <a
                href={`${THREAD_HOST}/certificate/${row.certNumber}`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                {row.certNumber}
              </a>
            </DetailRow>
          )}
        </section>

        {(d.amountCents != null || d.ticketName || d.couponCode) && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-ink-muted mb-2">Payment</h3>
            <div className="space-y-2">
              <DetailRow label="Amount">
                {fmtMoney(d.amountCents, d.currency)}
                {d.method ? ` · ${d.method === 'invoice' ? 'by invoice' : 'card'}` : ''}
                {` · ${row.payment}`}
              </DetailRow>
              {d.ticketName && <DetailRow label="Ticket">{d.ticketName}</DetailRow>}
              {d.couponCode && <DetailRow label="Discount code">{d.couponCode}</DetailRow>}
              {d.billing && Object.values(d.billing).some(Boolean) && (
                <DetailRow label="Billing">
                  {[
                    d.billing.company,
                    d.billing.address,
                    [d.billing.postal_code, d.billing.city].filter(Boolean).join(' '),
                    d.billing.country,
                    d.billing.tax_no ? `Tax/VAT ${d.billing.tax_no}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </DetailRow>
              )}
            </div>
          </section>
        )}

        {answers.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-ink-muted mb-2">
              Registration answers
            </h3>
            <div className="space-y-2">
              {answers.map(([k, v]) => (
                <DetailRow key={k} label={prettyKey(k)}>
                  {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                </DetailRow>
              ))}
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
