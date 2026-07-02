// Combined print view — ?numbers=THR-...,THR-... renders each certificate
// on its own page and opens the browser's print dialog (save as PDF).
// Reached from the Enrolments page's "Download for print".

import { publicFetch } from '@/lib/public-api';
import { CertView, type CertSnapshot } from '../[number]/cert-view';
import { PrintTrigger } from './print-trigger';

type CertPayload = {
  certificate_number: string;
  recipient_name: string;
  template_snapshot: CertSnapshot;
};

export default async function BulkPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const numbers = (typeof sp.numbers === 'string' ? sp.numbers : '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 100);

  const certs = (
    await Promise.all(
      numbers.map((n) =>
        publicFetch<CertPayload>(
          `/api/v1/thread/public/certificate/${encodeURIComponent(n)}`,
        ).catch(() => null),
      ),
    )
  ).filter(Boolean) as CertPayload[];

  if (certs.length === 0) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <p className="text-sm text-ink-subtle">No certificates to print.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken print:bg-white">
      <PrintTrigger />
      <main className="mx-auto max-w-4xl px-6 py-8 print:p-0 print:max-w-none space-y-8 print:space-y-0">
        <p className="text-xs text-ink-muted text-center print:hidden">
          {certs.length} certificate{certs.length === 1 ? '' : 's'} — the print dialog opens
          automatically; choose “Save as PDF” to download.
        </p>
        {certs.map((c) => (
          <div key={c.certificate_number} className="break-after-page">
            <CertView snapshot={c.template_snapshot} />
          </div>
        ))}
      </main>
    </div>
  );
}
