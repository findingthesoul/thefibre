'use client';

// After a PAID checkout, the page basket is done with: empty it, so the next
// visit starts clean. Only on the success pages — a cancelled checkout comes
// back to the basket exactly as it was (basket-provider.tsx).

import { useEffect } from 'react';

export function ClearBasket({ workspaceSlug }: { workspaceSlug: string }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem(`thefibre.basket.${workspaceSlug}`);
    } catch {
      /* nothing stored, nothing to clear */
    }
  }, [workspaceSlug]);
  return null;
}
