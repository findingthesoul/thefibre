'use client';

// NEXT, as one list ordered by date.
//
// Sjoerd: "a list, organised per date… a timeline… and then a selector per
// organiser." Before this, the page's skeleton was the ORGANISER and the
// dates were scattered inside it, which answers "what does soul.com hold for
// me" — a question nobody asks. Time is the spine now, and the organiser
// became a filter, which is where it belongs.

import { useMemo, useState } from 'react';
import { QrCode, Video } from 'lucide-react';
import type { Entry } from '@/lib/timeline';
import type { Portal, Ticket as TicketRow, ThreadItem } from '@/lib/portal-api';
import { Rsvp, ThreadSheet } from './detail';

/** Day over month — how an agenda is scanned, and the same chip the detail
 *  sheet uses, so a card and its contents read alike. */
function DateChip({ iso, muted }: { iso: string; muted?: boolean }) {
  const d = new Date(iso);
  return (
    <div
      aria-hidden
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-line leading-none ${
        muted ? 'bg-surface' : 'bg-surface-sunken'
      }`}
    >
      <span className="text-base font-medium text-ink">
        {new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(d)}
      </span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
        {new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d)}
      </span>
    </div>
  );
}

function Card({
  entry,
  onOpen,
  past,
}: {
  entry: Entry;
  onOpen: (threadId: string, engagementId: string | null) => void;
  past?: boolean;
}) {
  // The RSVP control needs the agenda item it answers for. The timeline
  // carries the three fields it uses rather than the whole item, so the card
  // does not have to hold a second copy of the payload.
  const rsvpItem = entry.engagementId
    ? {
        id: entry.engagementId,
        rsvp: entry.rsvp,
        rsvp_enabled: entry.rsvpEnabled,
        title: entry.title,
        description: null,
        type: '',
        starts_at: entry.dateIso,
        ends_at: null,
        location: entry.where,
        location_url: entry.whereUrl,
        meeting_url: null,
        external_url: null,
      }
    : null;

  const meta = [entry.time, entry.organiser, entry.where].filter(Boolean).join(' · ');

  return (
    <li className={`rounded-xl border border-line bg-surface p-4 ${past ? 'opacity-70' : ''}`}>
      <div className="flex gap-3">
        <DateChip iso={entry.dateIso} muted={past} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* The card body is the trigger, not the whole <li> — the RSVP
                buttons live inside it, and a button inside a button is not a
                thing a browser will render. */}
            {entry.threadId ? (
              <button
                type="button"
                onClick={() => onOpen(entry.threadId!, entry.engagementId)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate font-medium text-ink">{entry.title}</span>
                <span className="mt-0.5 block truncate text-sm text-ink-muted">{meta}</span>
              </button>
            ) : (
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{entry.title}</span>
                <span className="mt-0.5 block truncate text-sm text-ink-muted">{meta}</span>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {entry.hasTicket && (
                <span
                  title="You have a ticket"
                  className="inline-flex items-center gap-1 text-xs text-ink-muted"
                >
                  <QrCode className="h-3.5 w-3.5" aria-hidden />
                </span>
              )}
              {/* The one action that matters right now. Outside the window
                  there is deliberately nothing: a Join button three months
                  early is clutter pretending to be an action. */}
              {entry.joinUrl && (
                <a
                  href={entry.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-medium text-surface hover:opacity-90"
                >
                  <Video className="h-4 w-4" aria-hidden />
                  Join
                </a>
              )}
            </div>
          </div>

          {rsvpItem?.rsvp_enabled && !past && <Rsvp item={rsvpItem} />}
        </div>
      </div>
    </li>
  );
}

export function Timeline({
  entries,
  past,
  threads,
  wallet,
}: {
  entries: Entry[];
  past: Entry[];
  /** Every thread that a card can open, by id, with the ticket that belongs
   *  to it. One sheet is rendered at a time — the one that was tapped. */
  threads: Record<string, { thread: ThreadItem; ticket: TicketRow | null }>;
  wallet: Portal['wallet'];
}) {
  const [organiser, setOrganiser] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const organisers = useMemo(
    () => [...new Set([...entries, ...past].map((e) => e.organiser))].sort(),
    [entries, past],
  );

  const keep = (e: Entry) => organiser === null || e.organiser === organiser;
  const upcoming = entries.filter(keep);
  const earlier = past.filter(keep);

  const open = openThread ? threads[openThread] : null;

  return (
    <>
      {/* The filter appears only when there is something to filter. With one
          organiser it is a control with a single meaningful setting, which is
          furniture. */}
      {organisers.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Chip active={organiser === null} onClick={() => setOrganiser(null)}>
            Everyone
          </Chip>
          {organisers.map((o) => (
            <Chip key={o} active={organiser === o} onClick={() => setOrganiser(o)}>
              {o}
            </Chip>
          ))}
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          {organiser ? `Nothing coming up with ${organiser}.` : 'Nothing coming up.'}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {upcoming.map((e) => (
            <Card key={e.key} entry={e} onOpen={(id) => setOpenThread(id)} />
          ))}
        </ul>
      )}

      {earlier.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="inline-flex min-h-11 items-center text-sm text-ink-subtle underline underline-offset-4 hover:text-ink"
          >
            {showPast ? 'Hide earlier' : `Earlier (${earlier.length})`}
          </button>
          {showPast && (
            <ul className="mt-3 space-y-3">
              {earlier.map((e) => (
                <Card key={e.key} entry={e} onOpen={(id) => setOpenThread(id)} past />
              ))}
            </ul>
          )}
        </div>
      )}

      {open && (
        <ThreadSheet
          thread={open.thread}
          ticket={open.ticket}
          wallet={wallet}
          open
          onClose={() => setOpenThread(null)}
        />
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
        active
          ? 'border-ink bg-ink text-surface'
          : 'border-line bg-surface text-ink-subtle hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
