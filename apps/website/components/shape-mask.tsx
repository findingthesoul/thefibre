'use client';

// Photography framed by paper (brief §6.4): a photo clipped INSIDE a
// cut-out shape. Until real gathering photos exist (consent-gated — EBBF
// Athens is the source), omit `src` and the solid shape renders instead:
// layouts never wait on photography.

import { useId } from 'react';
import { SHAPES, type ShapeName } from './shapes';

export function ShapeMask({
  shape,
  src,
  alt = '',
  className,
}: {
  shape: ShapeName;
  src?: string;
  alt?: string;
  className?: string;
}) {
  const id = useId().replace(/[:]/g, '');
  const s = SHAPES[shape];
  const [, , w, h] = s.viewBox.split(' ').map(Number);

  if (!src) {
    // Degradation IS the design: solid shape until the photo exists.
    return (
      <div className={className}>
        <svg viewBox={s.viewBox} fill="currentColor" aria-hidden="true" className="h-auto w-full">
          <path d={s.d} />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className ?? ''} ${s.aspect} relative overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `url(#${id})` }}
      />
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <clipPath id={id} clipPathUnits="objectBoundingBox">
            <path d={s.d} transform={`scale(${1 / w} ${1 / h})`} />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}
