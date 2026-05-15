'use client';

// Stub — Suite's original used Suite's Dialog API (DialogHeader/Body/Footer).
// Fibre's Dialog has a different surface area. Restore when we actually wire
// dirty-state UX into Meet's forms.

import type { ReactNode } from 'react';

export function DirtyNavGuard(_props: { dirty: boolean; children?: ReactNode }) {
  return null;
}
