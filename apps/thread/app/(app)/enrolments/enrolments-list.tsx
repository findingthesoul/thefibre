'use client';

// Enrolments list with selection (Sjoerd 2026-07-02, v3 parity): tick
// participants (or select all), then issue certificates, download them for
// printing (one combined print view), or send them by email — each step
// explicit and separate.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Flag, Mail, Printer, Search } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t, enrolStatusLabel } from '@/lib/i18n-ui';
import { ParticipantDialog, type EnrolmentDetail } from './participant-dialog';
import { issueEnrolmentCertificate, sendCertificateEmail } from '../threads/actions';
import { completeEnrolment } from '../threads/[id]/registrations-actions';
import { IssueCertButton } from './certificate-actions';
import { Button } from '@/components/ui/button';

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-surface-sunken text-ink-subtle ring-line',
  enrolled: 'bg-sky-50 text-sky-700 ring-sky-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  dropped: 'bg-surface-sunken text-ink-muted ring-line',
};

export type { EnrolmentDetail };

export type EnrolmentRowData = {
  id: string;
  name: string;
  email: string | null;
  contact?: {
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    preferredLanguage?: string | null;
  } | null;
  threadId: string | null;
  threadTitle: string | null;
  certEnabled: boolean;
  certNumber: string | null;
  payment: string;
  status: string;
  detail: EnrolmentDetail;
};

export function EnrolmentsList({ locale, rows }: { locale: Locale; rows: EnrolmentRowData[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [detailRow, setDetailRow] = useState<EnrolmentRowData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Search: name, email, thread — over the loaded rows.
  const visibleRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.name, r.email ?? '', r.threadTitle ?? '', r.detail.ticketName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q]);
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const issuable = selectedRows.filter((r) => r.certEnabled && !r.certNumber);
  const withCert = selectedRows.filter((r) => r.certNumber);
  const completable = selectedRows.filter((r) => r.status === 'enrolled' || r.status === 'active');
  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleRows.map((r) => r.id)));
  }

  function issueSelected() {
    setMessage(null);
    startTransition(async () => {
      let ok = 0;
      let failed = 0;
      for (const r of issuable) {
        const res = await issueEnrolmentCertificate(r.id);
        if (res.ok) ok += 1;
        else failed += 1;
      }
      setMessage(
        t(locale, 'msg_issued', {
          n: ok,
          failed: failed ? t(locale, 'failed_suffix', { n: failed }) : '',
        }),
      );
      router.refresh();
    });
  }

  function completeSelected() {
    setMessage(null);
    startTransition(async () => {
      let ok = 0;
      let failed = 0;
      for (const r of completable) {
        const res = await completeEnrolment(r.id);
        if (res.ok) ok += 1;
        else failed += 1;
      }
      setMessage(
        t(locale, 'msg_completed', {
          n: ok,
          failed: failed ? t(locale, 'failed_suffix', { n: failed }) : '',
        }),
      );
      router.refresh();
    });
  }

  function downloadSelected() {
    const numbers = withCert.map((r) => r.certNumber!).join(',');
    // One combined print view — the browser's print dialog saves it as PDF.
    window.open(`/certificate/print?numbers=${encodeURIComponent(numbers)}`, '_blank');
  }

  function emailSelected() {
    setMessage(null);
    startTransition(async () => {
      let ok = 0;
      let failed = 0;
      for (const r of withCert) {
        const res = await sendCertificateEmail(r.id);
        if (res.ok) ok += 1;
        else failed += 1;
      }
      setMessage(
        t(locale, 'msg_emailed', {
          n: ok,
          failed: failed ? t(locale, 'failed_suffix', { n: failed }) : '',
        }),
      );
    });
  }

  return (
    <div className="mt-6">
      {/* Action bar — search + selection functions. */}
      <div className="flex flex-wrap items-center gap-3 min-h-[36px]">
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(locale, 'search_enrolments_placeholder')}
            className="w-full h-8 rounded-md border border-line bg-surface-raised pl-8 pr-2.5 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-ink-subtle cursor-pointer select-none">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          {selected.size > 0
            ? t(locale, 'n_selected', { n: selected.size })
            : t(locale, 'select_all')}
        </label>
        {selected.size > 0 && (
          <>
            <Button
              variant="secondary"
              size="sm"
              leading={<Award size={14} />}
              disabled={pending || issuable.length === 0}
              onClick={issueSelected}
              title={issuable.length === 0 ? t(locale, 'tooltip_no_awaiting') : undefined}
            >
              {pending
                ? t(locale, 'working')
                : t(locale, 'issue_certificates_n', { n: issuable.length })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leading={<Flag size={14} />}
              disabled={pending || completable.length === 0}
              onClick={completeSelected}
              title={completable.length === 0 ? t(locale, 'tooltip_no_enrolled') : undefined}
            >
              {t(locale, 'mark_completed_n', { n: completable.length })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leading={<Printer size={14} />}
              disabled={withCert.length === 0}
              onClick={downloadSelected}
              title={withCert.length === 0 ? t(locale, 'tooltip_no_certs') : undefined}
            >
              {t(locale, 'download_print_n', { n: withCert.length })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leading={<Mail size={14} />}
              disabled={pending || withCert.length === 0}
              onClick={emailSelected}
              title={withCert.length === 0 ? t(locale, 'tooltip_no_certs') : undefined}
            >
              {t(locale, 'send_by_email_n', { n: withCert.length })}
            </Button>
          </>
        )}
        {message && <span className="text-xs text-ink-muted">{message}</span>}
      </div>

      <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised">
        {visibleRows.map((r) => (
          <li key={r.id} className="flex items-center gap-4 px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={t(locale, 'select_name', { name: r.name })}
            />
            <button
              type="button"
              onClick={() => setDetailRow(r)}
              className="min-w-0 flex-1 text-left rounded-md -mx-1 px-1 hover:bg-surface-sunken/60 transition-colors"
            >
              <div className="text-sm font-medium truncate">{r.name}</div>
              <div className="text-xs text-ink-subtle mt-0.5 truncate">
                {r.email}
                {r.threadTitle ? ` · ${r.threadTitle}` : ''}
              </div>
            </button>
            {r.certEnabled && (
              <IssueCertButton
                locale={locale}
                enrolmentId={r.id}
                certificateNumber={r.certNumber}
              />
            )}
            <span className="text-xs text-ink-muted shrink-0">{r.payment}</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ring-1 shrink-0 ${
                STATUS_STYLES[r.status] ?? STATUS_STYLES.enrolled
              }`}
            >
              {enrolStatusLabel(locale, r.status)}
            </span>
          </li>
        ))}
      </ul>

      {detailRow && (
        <ParticipantDialog locale={locale} row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}

