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

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { CalendarPlus, Check, ExternalLink, QrCode, Video, Wallet, X } from 'lucide-react';
import {
  agendaIcsUrl,
  appleWalletUrl,
  googleWalletUrl,
  setRsvp,
  ticketQrUrl,
  type AgendaItem,
  type Portal,
  type RsvpResponse,
  type Ticket as TicketRow,
  type ThreadItem,
} from '@/lib/portal-api';

/** The date chip: day over month, which is how an agenda is scanned. The
 *  date used to sit right-aligned in small grey text, which is where you put
 *  something you do not want read. */
function dayMonth(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(d),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d),
  };
}

/** Just the clock, since the chip already carries the date. */
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

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
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-line-strong"
    >
      {children}
    </a>
  );
}

/**
 * The same thing without the word. "Join" and "Add to calendar" are already
 * labelled by their icon in every calendar app anyone uses, and four
 * equal-weight worded buttons per agenda row left the eye nothing to land on.
 * The name survives for screen readers and as a tooltip — dropping the label
 * is a visual decision, not an accessibility one.
 */
function IconLink({
  href,
  label,
  download,
  children,
}: {
  href: string;
  label: string;
  download?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      {...(download ? { download: '' } : { target: '_blank', rel: 'noreferrer' })}
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-subtle hover:border-line-strong hover:text-ink"
    >
      {children}
    </a>
  );
}

/** Day over month, left of the row. */
function DateChip({ iso }: { iso: string }) {
  const { day, month } = dayMonth(iso);
  return (
    <div
      aria-hidden
      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-surface-sunken leading-none"
    >
      <span className="text-base font-medium text-ink">{day}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{month}</span>
    </div>
  );
}

/**
 * Coming? — ONE segmented control over THREE states.
 *
 * Sjoerd asked for "a toggle for coming or not coming... or dropdown". Both
 * of those are two-state shapes and the answer is three: coming, can't, and
 * NO ANSWER. A toggle would have to render "no answer" as off, which is
 * precisely the collapse the whole design avoids — an organiser chasing
 * eight silences is doing something different from one reading eight
 * refusals, and v0.68.30's storage keeps them apart on purpose. So: a
 * segment per answer, none filled until you answer, and tapping the filled
 * one WITHDRAWS back to no answer. Three states, one control, two taps deep
 * at most.
 *
 * Segmented rather than a select because this is used on a phone at a door:
 * 44px targets beat a native picker. Design argued with the membership
 * session; Sjoerd can overrule it in a word.
 */
export function Rsvp({ item }: { item: AgendaItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Optimistic, because a tap that does nothing visible for 400ms gets tapped
  // again. The refresh below is what makes it true.
  const [answer, setAnswer] = useState<RsvpResponse | null>(item.rsvp);
  const [failed, setFailed] = useState(false);

  function choose(next: RsvpResponse) {
    const value = answer === next ? 'none' : next;
    const previous = answer;
    setAnswer(value === 'none' ? null : next);
    setFailed(false);
    start(async () => {
      try {
        await setRsvp(item.id, value);
        router.refresh();
      } catch {
        setAnswer(previous);
        setFailed(true);
      }
    });
  }

  const seg =
    'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 text-sm transition-colors disabled:opacity-60';

  return (
    <div className="mt-3">
      <div
        role="group"
        aria-label="Are you coming?"
        className="flex overflow-hidden rounded-lg border border-line"
      >
        <button
          type="button"
          onClick={() => choose('coming')}
          disabled={pending}
          aria-pressed={answer === 'coming'}
          className={`${seg} border-r border-line ${
            answer === 'coming' ? 'bg-ink text-surface' : 'bg-surface text-ink hover:bg-surface-sunken'
          }`}
        >
          <Check className="h-4 w-4" aria-hidden />
          Coming
        </button>
        <button
          type="button"
          onClick={() => choose('not_coming')}
          disabled={pending}
          aria-pressed={answer === 'not_coming'}
          className={`${seg} ${
            answer === 'not_coming'
              ? 'bg-ink text-surface'
              : 'bg-surface text-ink hover:bg-surface-sunken'
          }`}
        >
          <X className="h-4 w-4" aria-hidden />
          Can&rsquo;t
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {answer === null
          ? 'You haven\u2019t answered yet.'
          : 'Tap again to undo.'}
      </p>
      {failed && (
        <p className="mt-1 text-xs text-ink-muted">
          That didn&rsquo;t save. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

function AgendaRow({ threadId, item }: { threadId: string; item: AgendaItem }) {
  const link = item.meeting_url ?? item.external_url;
  return (
    <li className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="flex gap-3">
        {item.starts_at ? <DateChip iso={item.starts_at} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-ink">{item.title}</p>
              {/* The venue is a link when the organiser gave one — the map
                  link has been on the engagement all along and was published
                  nowhere (v0.68.62 fixed the public page; this is the same
                  gap on the same field). */}
              <p className="text-sm text-ink-muted">
                {item.starts_at && fmtTime(item.starts_at)}
                {item.starts_at && item.location && ' · '}
                {item.location &&
                  (item.location_url ? (
                    <a
                      href={item.location_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-ink"
                    >
                      {item.location}
                    </a>
                  ) : (
                    item.location
                  ))}
              </p>
            </div>
            {/* Icons, not worded buttons: four equal-weight labels per row is
                what "no clear overview" actually meant. */}
            <div className="flex shrink-0 gap-1.5">
              {link && (
                <IconLink href={link} label={item.meeting_url ? 'Join' : 'Open link'}>
                  {item.meeting_url ? (
                    <Video className="h-5 w-5" aria-hidden />
                  ) : (
                    <ExternalLink className="h-5 w-5" aria-hidden />
                  )}
                </IconLink>
              )}
              {/* Only items with a real timestamp: a thread carries dates, and
                  an all-day VEVENT would be machinery for no benefit. */}
              {item.starts_at && (
                <IconLink
                  href={agendaIcsUrl(threadId, item.id)}
                  label="Add to calendar"
                  download
                >
                  <CalendarPlus className="h-5 w-5" aria-hidden />
                </IconLink>
              )}
            </div>
          </div>
          {item.description && <p className="mt-1 text-sm text-ink-subtle">{item.description}</p>}
          {item.rsvp_enabled && <Rsvp item={item} />}
        </div>
      </div>
    </li>
  );
}

/**
 * The sheet, without a trigger.
 *
 * It used to own its own card and its own open state. Since v0.68.59 the
 * timeline owns both: one card can be a SESSION inside a thread rather than
 * the thread itself, and the same sheet is opened from several cards. So the
 * component that knows what was tapped opens it.
 */
export function ThreadSheet({
  thread,
  ticket,
  wallet,
  open,
  onClose,
}: {
  thread: ThreadItem;
  ticket: TicketRow | null;
  wallet: Portal['wallet'];
  open: boolean;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  const when = fmtDate(thread.starts_on);

  // Escape must close the TOPMOST layer. The shared Dialog listens for it on
  // `document` in the bubble phase, and it registered first because it opened
  // first — so without this, one press closed the dialog UNDERNEATH and left
  // the full-screen QR floating over the thread list with its parent gone
  // (found on staging, round five). A CAPTURE-phase listener on the same node
  // runs before every bubble listener there, and stopImmediatePropagation
  // keeps the key from reaching the Dialog at all. Only while zoomed, so the
  // Dialog keeps its own Escape the rest of the time.
  useEffect(() => {
    if (!zoom) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      setZoom(false);
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [zoom]);
  const code = ticket?.checkin_code ?? null;

  return (
    <>
      <Dialog open={open} onClose={onClose} title={thread.title} description={when} size="lg">
        {/* The QR is the reason this page exists and it is NOT redesigned.
            It is only laid out sideways and made tappable, for one measured
            reason: at 375px this dialog is a bottom sheet and the ticket
            block alone filled about half the viewport, so the agenda began
            below the fold from the first item. Side by side, the first
            agenda row is visible without scrolling — which is worth more
            than anything done to rows two and three. Full size is one tap
            away, which is the size that matters at a door. */}
        {code && (
          <section className="mb-5">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setZoom(true)}
                aria-label="Show the check-in code full size"
                className="shrink-0 rounded-lg bg-white p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ticketQrUrl(code)}
                  alt={`Check-in code for ${thread.title}`}
                  className="h-24 w-24"
                />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {ticket?.checked_in_at ? 'Already checked in' : 'Show this at the door'}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">Tap the code to enlarge.</p>
                {(wallet.apple || wallet.google) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {wallet.apple && (
                      <IconLink href={appleWalletUrl(code)} label="Add to Apple Wallet">
                        <Wallet className="h-5 w-5" aria-hidden />
                      </IconLink>
                    )}
                    {wallet.google && (
                      <IconLink href={googleWalletUrl(code)} label="Save to Google Wallet">
                        <Wallet className="h-5 w-5" aria-hidden />
                      </IconLink>
                    )}
                  </div>
                )}
              </div>
            </div>
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

        {/* A tappable target, not a line of text. This surface is used on a
            phone, often one-handed at a door; a 17px-tall link was under half
            the ~44px guidance (measured on staging at 375px, 2026-09-09). */}
        <div className="mt-6 border-t border-line pt-4">
          <ActionLink href={thread.url}>Open the full page</ActionLink>
        </div>
      </Dialog>

      {/* Full size, white, nothing else on screen — the same treatment
          ticket.tsx gives an orphan ticket, for the same reason: held at
          arm's length, half-turned toward someone else, sometimes in sun. */}
      {zoom && code && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Check-in code for ${thread.title}`}
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-white p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ticketQrUrl(code)}
            alt={`Check-in code for ${thread.title}`}
            className="w-full max-w-xs"
          />
          <p className="text-lg font-medium text-black">{thread.title}</p>
          <p className="text-sm text-neutral-500">Tap anywhere to close</p>
        </div>
      )}
    </>
  );
}
