'use client';

// The public certificate PAGE's wrapper around the shared renderer.
//
// What is left here is everything that belongs to the page rather than to the
// certificate: the print button, the auto-print on `?print=1` that the email
// link uses, and the print stylesheet that makes "Save as PDF" produce the
// real artefact (decision 2026-07-01: print-quality HTML, no server-side PDF).
//
// The drawing itself moved to `@thefibre/shared/ui/cert-view` on 2026-09-25,
// when the visitor portal needed to show a person their own certificate. One
// renderer, so a thumbnail in someone's portal is the same document as the
// page an employer verifies — not a second implementation that looks similar
// until a font or a QR moves.

import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { CertView as SharedCertView, type CertSnapshot } from '@thefibre/shared/ui/cert-view';

export type { CertSnapshot };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://thefibre-api.fly.dev';

export function CertView({ snapshot }: { snapshot: CertSnapshot }) {
  const { template } = snapshot;

  // Auto-print when opened with ?print=1 (link from the email/page).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('print') === '1') {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div>
      <SharedCertView snapshot={snapshot} apiBase={API_BASE} />

      <div className="mt-6 flex items-center justify-center print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-ink text-ink-inverse px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Printer size={15} strokeWidth={1.75} />
          Print / Save as PDF
        </button>
      </div>

      {/* Print: the page IS the certificate. */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${template.page_size === 'letter' ? 'letter' : 'A4'}
              ${template.orientation};
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          .cert-page,
          .cert-page * {
            visibility: visible;
          }
          .cert-page {
            position: fixed !important;
            inset: 0;
            width: 100vw !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
