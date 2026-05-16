'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { appUrl } from '@thefibre/shared';

export type Contact = {
  id: string;
  email: string | null;
  name: string | null;
  domain: string | null;
  is_user: boolean;
  is_team_member: boolean;
  meet_bookings: number;
  meet_last_booked_at: string | null;
  source: Array<'booking' | 'team'>;
};

const FIBRE_BASE = appUrl('fibre-platform', process.env as Record<string, string | undefined>);

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ContactRow({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false);
  const profileUrl = `${FIBRE_BASE}/contacts/${contact.id}`;

  return (
    <>
      <li
        onClick={() => setOpen(true)}
        className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-4 text-sm cursor-pointer hover:bg-surface-sunken transition-colors"
      >
        <div className="font-medium truncate flex items-center gap-2">
          {contact.name ?? '—'}
          {contact.is_team_member && (
            <span className="text-[9px] uppercase tracking-wider text-ink-muted border border-line rounded px-1 py-0.5">
              Team
            </span>
          )}
          {contact.source.includes('booking') && (
            <span className="text-[9px] uppercase tracking-wider text-ink-muted border border-line rounded px-1 py-0.5">
              Booked
            </span>
          )}
        </div>
        <div className="text-ink-subtle truncate">{contact.email ?? '—'}</div>
        <div className="text-xs text-ink-muted truncate">{contact.domain ?? '—'}</div>
        <div className="text-xs text-ink-muted whitespace-nowrap">
          {contact.meet_bookings > 0
            ? `${contact.meet_bookings} booking${contact.meet_bookings === 1 ? '' : 's'}`
            : '—'}
        </div>
        <div className="text-xs text-ink-muted whitespace-nowrap">
          {fmtDate(contact.meet_last_booked_at)}
        </div>
      </li>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={contact.name ?? contact.email ?? 'Contact'}
        description={contact.email ?? undefined}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <a
              href={profileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-strong text-white px-3 py-1.5 text-sm font-medium hover:bg-ink"
            >
              Open in The Fibre <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </>
        }
      >
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <Label>Email</Label>
          <Value>{contact.email ?? '—'}</Value>

          <Label>Domain</Label>
          <Value>{contact.domain ?? '—'}</Value>

          <Label>In Meet because</Label>
          <Value>
            <div className="flex flex-wrap gap-1.5">
              {contact.source.includes('booking') && <Chip>Booked a meeting</Chip>}
              {contact.is_team_member && <Chip>Member of a Meet team</Chip>}
              {contact.source.length === 0 && !contact.is_team_member && <span>—</span>}
            </div>
          </Value>

          <Label>Bookings</Label>
          <Value>{contact.meet_bookings}</Value>

          <Label>Last booked</Label>
          <Value>{fmtDate(contact.meet_last_booked_at)}</Value>

          <Label>Has account</Label>
          <Value>{contact.is_user ? 'Yes' : 'No'}</Value>
        </div>

        <p className="mt-6 text-xs text-ink-muted leading-relaxed">
          Identity (name, email, address) and change-context fields are managed
          in The Fibre platform. Open the full profile to edit.
        </p>
      </Dialog>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-ink-muted text-xs uppercase tracking-wider pt-0.5">{children}</div>;
}
function Value({ children }: { children: React.ReactNode }) {
  return <div className="text-ink-strong">{children}</div>;
}
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink">
      {children}
    </span>
  );
}
