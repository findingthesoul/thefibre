// Public certificate page — anyone with the number can verify it.
// Renders the issue-time snapshot; later template edits never change it.

import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { CertView, type CertSnapshot } from './cert-view';

type CertPayload = {
  certificate_number: string;
  recipient_name: string;
  issued_at: string;
  template_snapshot: CertSnapshot;
};

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

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <CertView snapshot={cert.template_snapshot} />
        <footer className="mt-6 text-center text-xs text-ink-muted print:hidden">
          <span className="font-mono">{cert.certificate_number}</span> · issued to{' '}
          {cert.recipient_name} on {issued} · Powered by{' '}
          <span className="font-medium">The Thread</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
