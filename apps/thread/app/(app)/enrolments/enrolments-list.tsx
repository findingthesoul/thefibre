'use client';

// Enrolments list with selection (Sjoerd 2026-07-02, v3 parity): tick
// participants (or select all), then issue certificates, download them for
// printing (one combined print view), or send them by email — each step
// explicit and separate.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, Flag, Mail, Printer, Search } from 'lucide-react';
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

export function EnrolmentsList({ rows }: { rows: EnrolmentRowData[] }) {
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
      setMessage(`Issued ${ok} certificate${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
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
        `Marked ${ok} completed${failed ? `, ${failed} failed` : ''} — certificates auto-issued where enabled.`,
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
      setMessage(`Emailed ${ok} certificate${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
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
            placeholder="Search name, email or thread…"
            className="w-full h-8 rounded-md border border-line bg-surface-raised pl-8 pr-2.5 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-ink-subtle cursor-pointer select-none">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        {selected.size > 0 && (
          <>
            <Button
              variant="secondary"
              size="sm"
              leading={<Award size={14} />}
              disabled={pending || issuable.length === 0}
              onClick={issueSelected}
              title={issuable.length === 0 ? 'Selection has no enrolments awaiting a certificate' : undefined}
            >
              {pending ? 'Working…' : `Issue certificates (${issuable.length})`}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leading={<Flag size={14} />}
              disabled={pending || completable.length === 0}
              onClick={completeSelected}
              title={completable.length === 0 ? 'Selection has no enrolled participants' : undefined}
            >
              Mark completed ({completable.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leading={<Printer size={14} />}
              disabled={withCert.length === 0}
              onClick={downloadSelected}
              title={withCert.length === 0 ? 'Selection has no issued certificates yet' : undefined}
            >
              Download for print ({withCert.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leading={<Mail size={14} />}
              disabled={pending || withCert.length === 0}
              onClick={emailSelected}
              title={withCert.length === 0 ? 'Selection has no issued certificates yet' : undefined}
            >
              Send by email ({withCert.length})
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
              aria-label={`Select ${r.name}`}
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
              <IssueCertButton enrolmentId={r.id} certificateNumber={r.certNumber} />
            )}
            <span className="text-xs text-ink-muted shrink-0">{r.payment}</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                STATUS_STYLES[r.status] ?? STATUS_STYLES.enrolled
              }`}
            >
              {r.status}
            </span>
          </li>
        ))}
      </ul>

      {detailRow && (
        <ParticipantDialog row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}

