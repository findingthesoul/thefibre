'use client';

// An issued certificate, rendered from its snapshot.
//
// The same %-positioned element model the builder uses, scaled to whatever
// width the container gives it — which is what lets one component be a full
// A4 page on the public verification page and a thumbnail in somebody's
// portal, with no second implementation and no drift between what the
// organiser designed and what the holder sees.
//
// A SNAPSHOT, not a template. Everything here comes from the copy taken at
// issue time, so an organiser editing the design next year does not change a
// certificate already in someone's hands. That is the whole reason the
// snapshot column exists and this component must never reach past it.
//
// Lifted out of apps/thread on 2026-09-25 for the visitor portal. Two things
// stayed behind because they belong to the PAGE and not to the certificate:
// the print button, and the auto-print on `?print=1`.

import { useEffect, useRef, useState } from 'react';
import {
  PAGE_ASPECT,
  substituteFields,
  elFontStyle,
  type CertElement,
  type CertPageSize,
  type CertOrientation,
} from '../certificate.js';

export type CertSnapshot = {
  template: {
    page_size: CertPageSize;
    orientation: CertOrientation;
    background_url: string | null;
    elements: CertElement[];
  };
  values: Record<string, string>;
};

/** Font sizes in the document are px at this width; everything scales from
 *  it. A thumbnail is therefore the same certificate, smaller — not a
 *  different layout that happens to look similar. */
const BUILDER_WIDTH = 700;

export function CertView({
  snapshot,
  apiBase,
  className,
}: {
  snapshot: CertSnapshot;
  /** Where the QR image is served from. Injected rather than read from the
   *  environment here: this package compiles for browsers and has no node
   *  types, and the caller is the one that knows which stack it is on. */
  apiBase: string;
  className?: string;
}) {
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

  return (
    <div
      ref={ref}
      className={
        className ??
        'cert-page relative w-full overflow-hidden rounded-lg ring-1 ring-line bg-white print:ring-0 print:rounded-none'
      }
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
          return <div key={el.id} style={{ ...style, height: 2, background: el.color ?? '#1a1a2e' }} />;
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
              src={`${apiBase}/api/v1/thread/public/certificate/${encodeURIComponent(number)}/qr.png`}
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
  );
}
