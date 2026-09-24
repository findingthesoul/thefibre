'use client';

// Subscribe your calendar to everything you are taking part in.
//
// Sjoerd, 2026-09-23: "can I also subscribe to the whole sequence? And do
// things get updates when there is a change in date?" The two questions have
// one answer. Adding sessions one at a time hands your calendar a COPY, and a
// copy is frozen — when an organiser moves a session, the person who added it
// is the last to know. A subscription is the live answer instead: the
// calendar re-reads it every few hours, and a moved session moves.
//
// THE ADDRESS IS SHOWN ONCE. It is stored hashed, the way an API key is, so
// there is no screen anywhere that can show it again — including to us. That
// is a deliberate trade and the copy says so out loud, because a person who
// expects to find it later and cannot would be right to be annoyed. Losing it
// costs one button, which also retires the old address.

import { useState } from 'react';
import { CalendarPlus, Check, Copy, RefreshCw } from 'lucide-react';
import { createCalendar, deleteCalendar, type CalendarStatus } from '@/lib/portal-api';

export function CalendarCard({ status }: { status: CalendarStatus }) {
  const [subscribed, setSubscribed] = useState(status.subscribed);
  const [lastRead, setLastRead] = useState(status.last_read_at);
  // Present only in the moment after minting. Never re-fetched, because it
  // cannot be: see the note above.
  const [address, setAddress] = useState<{ url: string; webcal: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint() {
    setBusy(true);
    setError(null);
    try {
      const made = await createCalendar();
      setAddress({ url: made.url, webcal: made.webcal });
      setSubscribed(true);
      setLastRead(null);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setError(null);
    try {
      await deleteCalendar();
      setSubscribed(false);
      setAddress(null);
      setLastRead(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.url);
      setCopied(true);
    } catch {
      // Clipboard refused (an insecure origin, or a browser that asks). The
      // address is on screen and selectable, so this is a missing
      // convenience, not a missing feature — say nothing and let them select.
    }
  }

  const button =
    'inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium disabled:opacity-40';

  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-sm font-medium text-ink">Your calendar</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Follow every session you are taking part in. When an organiser moves a
        date, your calendar follows — you do not have to add anything again.
      </p>

      {address ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface-sunken p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Your calendar address
          </p>
          {/* Selectable and wrapping. A 64-character token in a one-line box
              that scrolls is a token nobody can copy by hand when the
              clipboard button fails. */}
          <p className="mt-2 break-all font-mono text-xs text-ink">{address.url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={`${button} bg-ink text-surface hover:opacity-90`}>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
            {/* webcal:// hands the address straight to the calendar app
                instead of the browser. One click on a phone, where pasting a
                64-character URL is the worst part of this whole flow. */}
            <a href={address.webcal} className={`${button} border border-line bg-surface text-ink hover:bg-surface-sunken`}>
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Open in calendar
            </a>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Keep this link private — anyone who has it can see your sessions.
            It is stored scrambled, so this is the only time it can be shown.
            If you lose it, make a new one.
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            In Google Calendar: Other calendars → From URL. In Apple Calendar:
            File → New Calendar Subscription.
          </p>
        </div>
      ) : subscribed ? (
        <p className="mt-4 text-sm text-ink-muted">
          A calendar address exists.{' '}
          {lastRead
            ? `Last collected ${relative(lastRead)}.`
            : 'Nothing has collected it yet — if you just added it, give your calendar an hour.'}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={mint}
          disabled={busy}
          className={
            subscribed
              ? `${button} border border-line bg-surface text-ink hover:bg-surface-sunken`
              : `${button} bg-ink text-surface hover:opacity-90`
          }
        >
          {subscribed ? <RefreshCw className="h-4 w-4" aria-hidden /> : <CalendarPlus className="h-4 w-4" aria-hidden />}
          {subscribed ? 'Make a new address' : 'Subscribe'}
        </button>
        {subscribed && (
          <button
            type="button"
            onClick={stop}
            disabled={busy}
            className="min-h-11 text-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-40"
          >
            Stop the calendar
          </button>
        )}
        {error && <span className="text-sm text-ink-muted">{error}</span>}
      </div>

      {subscribed && !address && (
        <p className="mt-2 text-xs text-ink-muted">
          Making a new address stops the old one working everywhere you added it.
        </p>
      )}
    </section>
  );
}

/** Coarse on purpose: "is my calendar following this" is answered by hours
 *  and days, and a precise timestamp invites reading a fetch schedule that
 *  belongs to Google, not to us. */
function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return 'just now';
  if (minutes < 60) return 'in the last hour';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
