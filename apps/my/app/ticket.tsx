'use client';

// The ticket, and the reason this app exists before the rest of it does:
// today the QR lives only inside an enrolment email. Delete the email and
// you are on the door volunteer's name-search fallback.
//
// Tapping opens it large — a phone at a door is held at arm's length, often
// half-turned toward someone else, sometimes in the sun.

import { useState } from 'react';
import { ticketQrUrl } from '@/lib/portal-api';
import type { Ticket as TicketRow } from '@/lib/portal-api';

export function Ticket({ ticket }: { ticket: TicketRow }) {
  const [open, setOpen] = useState(false);
  if (!ticket.checkin_code) return null;
  const src = ticketQrUrl(ticket.checkin_code);
  const used = !!ticket.checked_in_at;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-xl border border-line bg-surface-raised p-3 text-left hover:border-line-strong"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded bg-white" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{ticket.title}</span>
          {ticket.location && (
            <span className="block truncate text-sm text-ink-muted">{ticket.location}</span>
          )}
          <span className="mt-0.5 block text-xs text-ink-muted">
            {used ? 'Checked in' : 'Tap to show at the door'}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ticket for ${ticket.title}`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Check-in code for ${ticket.title}`}
            className="w-full max-w-xs"
          />
          <div className="text-center">
            <p className="text-lg font-medium text-black">{ticket.title}</p>
            {ticket.location && <p className="text-sm text-neutral-600">{ticket.location}</p>}
            {used && <p className="mt-2 text-sm text-neutral-600">Already checked in</p>}
          </div>
          <p className="text-sm text-neutral-500">Tap anywhere to close</p>
        </div>
      )}
    </>
  );
}
