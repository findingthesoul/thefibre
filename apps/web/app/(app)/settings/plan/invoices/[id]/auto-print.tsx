'use client';

// ?print=1 → open the browser's print dialog once the page settles. The
// shared invoice dialog's Print button targets this.

import { useEffect } from 'react';

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
