// Public certificate page — anyone with the number can verify it.
// Renders the issue-time snapshot; later template edits never change it.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Linkedin, Printer } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { CertView, type CertSnapshot } from './cert-view';

const THREAD_HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

type CertPayload = {
  certificate_number: string;
  recipient_name: string;
  issued_at: string;
  template_snapshot: CertSnapshot;
};

/**
 * The page title IS the PDF's filename: browsers name a "Save as PDF" after
 * document.title. So the title is built as name . course . number rather
 * than something decorative, and a folder of downloads sorts and searches
 * the way an administrator needs (Sjoerd 2026-09-01).
 *
 * Characters that break filenames on some systems are replaced rather than
 * stripped, so nothing silently runs together.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  try {
    const cert = await publicFetch<CertPayload>(
      `/api/v1/thread/public/certificate/${encodeURIComponent(number)}`,
    );
    const course = cert.template_snapshot.values?.thread_title ?? '';
    const safe = (v: string) => v.replace(/[\\/:*?"<>|]/g, '-').trim();
    const title = [safe(cert.recipient_name), safe(course), safe(cert.certificate_number)]
      .filter(Boolean)
      .join(' \u00b7 ');
    return { title: title || `Certificate ${number}` };
  } catch {
    return { title: `Certificate ${number}` };
  }
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;

  let cert: CertPayload;
  try {
    cert = await publicFetch<CertPayload>(
      `/api/v1/thread/public/certificate/${encodeURIComponent(number)}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const issued = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(cert.issued_at));

  // LinkedIn: "Add to profile" pre-fills a certification entry; plain share
  // posts the public URL. (v3 parity.)
  const certUrl = `${THREAD_HOST}/certificate/${encodeURIComponent(cert.certificate_number)}`;
  const values = cert.template_snapshot.values ?? {};
  const issuedDate = new Date(cert.issued_at);
  const addToLinkedIn =
    'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME' +
    `&name=${encodeURIComponent(values.thread_title ?? 'Certificate')}` +
    `&organizationName=${encodeURIComponent(values.org_name || values.issued_by || 'The Thread')}` +
    `&issueYear=${issuedDate.getFullYear()}&issueMonth=${issuedDate.getMonth() + 1}` +
    `&certUrl=${encodeURIComponent(certUrl)}` +
    `&certId=${encodeURIComponent(cert.certificate_number)}`;
  const shareOnLinkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl)}`;

  const ACTION =
    'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-sm font-medium transition-colors';

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <CertView snapshot={cert.template_snapshot} />

        <div className="mt-6 flex items-center justify-center gap-2.5 print:hidden">
          <a
            href={addToLinkedIn}
            target="_blank"
            rel="noreferrer"
            className={`${ACTION} bg-[#0a66c2] text-white hover:opacity-90`}
          >
            <Linkedin size={15} strokeWidth={1.75} />
            Add to LinkedIn profile
          </a>
          <a
            href={shareOnLinkedIn}
            target="_blank"
            rel="noreferrer"
            className={`${ACTION} border border-line bg-surface-raised text-ink-subtle hover:text-ink hover:bg-surface-sunken`}
          >
            Share
          </a>
          <a
            href={`?print=1`}
            className={`${ACTION} border border-line bg-surface-raised text-ink-subtle hover:text-ink hover:bg-surface-sunken`}
          >
            <Printer size={15} strokeWidth={1.75} />
            Print / PDF
          </a>
        </div>

        <footer className="mt-6 text-center text-xs text-ink-muted print:hidden">
          <span className="font-mono">{cert.certificate_number}</span> · issued to{' '}
          {cert.recipient_name} on {issued} · Powered by{' '}
          <span className="font-medium">The Thread</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
