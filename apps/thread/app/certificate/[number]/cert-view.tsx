'use client';

// Renders an ISSUED certificate from its snapshot — the same %-positioned
// element model as the builder, scaled to the container. Print uses A4/Letter
// CSS so "Save as PDF" from the browser produces the real artefact
// (decision 2026-07-01: print-quality HTML, no server-side PDF).

import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import {
  PAGE_ASPECT,
  substituteFields,
  elFontStyle,
  type CertElement,
  type CertPageSize,
  type CertOrientation,
} from '@/lib/certificate-types';

export type CertSnapshot = {
  template: {
    page_size: CertPageSize;
    orientation: CertOrientation;
    background_url: string | null;
    elements: CertElement[];
  };
  values: Record<string, string>;
};

const BUILDER_WIDTH = 700; // font sizes in the doc are px at this width

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://thefibre-api.fly.dev';

export function CertView({ snapshot }: { snapshot: CertSnapshot }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { template, values } = snapshot;
  const aspect = PAGE_ASPECT[template.page_size]?.[template.orientation] ?? 1.4142;

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setScale(el.clientWidth / BUILDER_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-print when opened with ?print=1 (link from the email/page).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('print') === '1') {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div>
      <div
        ref={ref}
        className="cert-page relative w-full overflow-hidden rounded-lg ring-1 ring-line bg-white print:ring-0 print:rounded-none"
        style={{
          paddingBottom: `${(1 / aspect) * 100}%`,
          backgroundImage: template.background_url ? `url(${template.background_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {template.elements.map((el) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            opacity: (el.opacity ?? 100) / 100,
          };
          if (el.type === 'line') {
            return (
              <div
                key={el.id}
                style={{ ...style, height: 2, background: el.color ?? '#1a1a2e' }}
              />
            );
          }
          if (el.type === 'image') {
            return el.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={el.id} src={el.src} alt="" style={{ ...style, height: 'auto' }} />
            ) : null;
          }
          if (el.type === 'qr') {
            // Encodes this certificate's own page. Served by the API rather
            // than generated here so it prints at whatever resolution the
            // printer wants.
            const number = values.certificate_number ?? '';
            return number ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={el.id}
                src={`${API_BASE}/api/v1/thread/public/certificate/${encodeURIComponent(number)}/qr.png`}
                alt={`Verify certificate ${number}`}
                style={{ ...style, height: 'auto' }}
              />
            ) : null;
          }
          const text =
            el.type === 'field'
              ? values[el.field ?? ''] ?? ''
              : substituteFields(el.content ?? '', values);
          return (
            <div
              key={el.id}
              style={{
                ...style,
                ...elFontStyle(el),
                fontSize: `${(el.fontSize ?? 16) * scale}px`,
                lineHeight: 1.25,
                whiteSpace: 'pre-wrap',
              }}
            >
              {text}
            </div>
          );
        })}
      </div>

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
