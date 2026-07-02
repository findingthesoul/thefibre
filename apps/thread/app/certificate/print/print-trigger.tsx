'use client';

import { useEffect } from 'react';

/** Opens the print dialog once the certificates have painted. */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, []);
  return null;
}
