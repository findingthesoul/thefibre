'use client';

// Per-row "Issue certificate" + thread-level bulk issue on the Enrolments
// page. Shown only when the thread has certificates enabled.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Award, ExternalLink, RefreshCw } from 'lucide-react';
import {
  issueEnrolmentCertificate,
  bulkIssueCertificates,
  reissueCertificate,
} from '../threads/actions';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const THREAD_HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

export function IssueCertButton({
  enrolmentId,
  certificateNumber,
}: {
  enrolmentId: string;
  certificateNumber: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmReissue, setConfirmReissue] = useState(false);
  const [pending, startTransition] = useTransition();

  if (certificateNumber) {
    return (
      <span className="inline-flex items-center gap-1 shrink-0">
        <a
          href={`${THREAD_HOST}/certificate/${certificateNumber}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ring-1 ring-emerald-200 bg-emerald-50 text-emerald-700 hover:ring-emerald-300"
          title={certificateNumber}
        >
          <Award size={11} strokeWidth={1.75} />
          Certificate
          <ExternalLink size={10} strokeWidth={1.75} />
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmReissue(true)}
          title="Reissue — regenerate from the current template (number and issue date stay)"
          aria-label="Reissue certificate"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-50"
        >
          <RefreshCw size={11} strokeWidth={1.75} className={pending ? 'animate-spin' : ''} />
        </button>
        {error && <span className="text-[11px] text-red-700">{error}</span>}
        <ConfirmDialog
          open={confirmReissue}
          onCancel={() => setConfirmReissue(false)}
          onConfirm={() => {
            setConfirmReissue(false);
            setError(null);
            startTransition(async () => {
              const r = await reissueCertificate(enrolmentId);
              if (!r.ok) setError(r.error);
              router.refresh();
            });
          }}
          title="Reissue certificate"
          message={`This regenerates ${certificateNumber} from the CURRENT template design. The number, recipient and issue date stay the same — shared links keep working — but the look changes to the template as it is now.`}
          confirmLabel="Reissue"
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        disabled={pending}
        title={error ?? 'Issue certificate'}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await issueEnrolmentCertificate(enrolmentId);
            if (!r.ok) setError(r.error);
            router.refresh();
          });
        }}
        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ring-1 transition-colors ${
          error
            ? 'ring-red-200 bg-red-50 text-red-700'
            : 'ring-line bg-surface-raised text-ink-subtle hover:text-ink hover:ring-line-strong'
        } disabled:opacity-50`}
      >
        <Award size={11} strokeWidth={1.75} />
        {pending ? 'Issuing…' : error ? 'Failed — retry' : 'Issue certificate'}
      </button>
    </span>
  );
}

export function BulkIssueButton({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        leading={<Award size={14} />}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await bulkIssueCertificates(threadId);
            setResult(
              r.ok ? `Issued ${r.issued}, skipped ${r.skipped} (only completed enrolments).` : r.error,
            );
            router.refresh();
          })
        }
      >
        {pending ? 'Issuing…' : 'Issue to completed'}
      </Button>
      {result && <span className="text-xs text-ink-muted">{result}</span>}
    </span>
  );
}
