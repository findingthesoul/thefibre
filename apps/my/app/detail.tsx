'use client';

// The thing you are part of, opened.
//
// The list answers "what am I in"; this answers "what do I need, now, at the
// door or on the way there". So the order is deliberate and physical: the QR
// first because a phone at a door is held at arm's length, then the ways to
// keep it (wallet, calendar), then the agenda, then the page it came from.
//
// Everything here is a link. There is no state to save and no call that
// changes anything, which is why it can be a plain dialog rather than a form.

import { useState } from 'react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { Calendar, QrCode, Wallet } from 'lucide-react';
import {
  agendaIcsUrl,
  appleWalletUrl,
  googleWalletUrl,
  ticketQrUrl,
  type AgendaItem,
  type Portal,
  type Ticket as TicketRow,
  type ThreadItem,
} from '@/lib/portal-api';

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** A link styled as a button. Not the shared Button: these are anchors, and a
 *  wallet pass or an .ics must be a real navigation, not an onClick. */
function ActionLink({
  href,
  children,
  download,
}: {
  href: string;
  children: React.ReactNode;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      {...(download ? { download: '' } : { target: '_blank', rel: 'noreferrer' })}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-line-strong"
    >
      {children}
    </a>
  );
}

function AgendaRow({ threadId, item }: { threadId: string; item: AgendaItem }) {
  const link = item.meeting_url ?? item.external_url;
  return (
    <li className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-ink">{item.title}</span>
        {item.starts_at && (
          <span className="shrink-0 text-xs text-ink-muted">{fmtDateTime(item.starts_at)}</span>
        )}
      </div>
      {item.description && <p className="mt-1 text-sm text-ink-subtle">{item.description}</p>}
      {item.location && <p className="mt-0.5 text-sm text-ink-muted">{item.location}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {link && (
          <ActionLink href={link}>{item.meeting_url ? 'Join' : 'Open'}</ActionLink>
        )}
        {/* Only items with a real timestamp: a thread carries dates, and an
            all-day VEVENT would be machinery for no benefit. */}
        {item.starts_at && (
          <ActionLink href={agendaIcsUrl(threadId, item.id)} download>
            <Calendar className="h-4 w-4" aria-hidden />
            Add to calendar
          </ActionLink>
        )}
      </div>
    </li>
  );
}

export function ThreadDetail({
  thread,
  ticket,
  wallet,
}: {
  thread: ThreadItem;
  ticket: TicketRow | null;
  wallet: Portal['wallet'];
}) {
  const [open, setOpen] = useState(false);
  const when = fmtDate(thread.starts_on);
  const code = ticket?.checkin_code ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-line bg-surface-raised p-4 text-left hover:border-line-strong"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium text-ink">{thread.title}</span>
          {thread.progress_pct != null && (
            <span className="shrink-0 text-xs text-ink-muted">{thread.progress_pct}%</span>
          )}
        </div>
        {when && <p className="mt-0.5 text-sm text-ink-muted">{when}</p>}
        <p className="mt-1 flex items-center gap-3 text-xs text-ink-muted">
          {code && (
            <span className="inline-flex items-center gap-1">
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              Ticket
            </span>
          )}
          {thread.agenda.length > 0 && <span>{thread.agenda.length} on the agenda</span>}
        </p>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={thread.title} description={when} size="lg">
        {code && (
          <section className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ticketQrUrl(code)}
              alt={`Check-in code for ${thread.title}`}
              className="mx-auto w-full max-w-[220px] rounded-lg bg-white p-3"
            />
            <p className="mt-2 text-center text-xs text-ink-muted">
              {ticket?.checked_in_at ? 'Already checked in' : 'Show this at the door'}
            </p>
            {(wallet.apple || wallet.google) && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {wallet.apple && (
                  <ActionLink href={appleWalletUrl(code)}>
                    <Wallet className="h-4 w-4" aria-hidden />
                    Add to Apple Wallet
                  </ActionLink>
                )}
                {wallet.google && (
                  <ActionLink href={googleWalletUrl(code)}>
                    <Wallet className="h-4 w-4" aria-hidden />
                    Save to Google Wallet
                  </ActionLink>
                )}
              </div>
            )}
          </section>
        )}

        {thread.agenda.length > 0 ? (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">Agenda</h3>
            <ul className="mt-2">
              {thread.agenda.map((a) => (
                <AgendaRow key={a.id} threadId={thread.thread_id} item={a} />
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-sm text-ink-muted">No agenda published yet.</p>
        )}

        <p className="mt-6 border-t border-line pt-4 text-sm">
          <a
            href={thread.url}
            target="_blank"
            rel="noreferrer"
            className="text-ink underline underline-offset-2 hover:opacity-70"
          >
            Open the full page
          </a>
        </p>
      </Dialog>
    </>
  );
}
