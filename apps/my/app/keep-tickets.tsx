'use client';

// Writes the tickets this device keeps, every time the portal loads online.
//
// Rendered by the page that already has the list, so there is no second fetch
// and no second idea of what a ticket is. It draws nothing.
//
// REPLACE, never merge: a ticket that has gone from the payload — cancelled,
// refunded, moved to another date — must go from the phone in the same breath.
// A device that keeps a ticket the server has withdrawn is worse than one that
// keeps none, because it will be shown at a door with confidence.

import { useEffect } from 'react';
import { keepTickets, type KeptTicket } from '@/lib/kept-tickets';

export function KeepTickets({ tickets }: { tickets: KeptTicket[] }) {
  useEffect(() => {
    keepTickets(tickets);
    // Warm the cache so the QR is on the device before the signal is gone.
    // The service worker holds them; a plain fetch is enough to put them
    // there, and a failure is silently fine — this is opportunistic.
    for (const t of tickets) {
      void fetch(`/ticket/${encodeURIComponent(t.code)}/qr`, { cache: 'force-cache' }).catch(
        () => {},
      );
    }
    // Serialised rather than by identity: the array is rebuilt on every
    // render, and re-writing storage on every render is pointless work.
  }, [JSON.stringify(tickets)]);

  return null;
}
