'use client';

// Subscribe your calendar to everything you are taking part in.
//
// Sjoerd, 2026-09-23: "can I also subscribe to the whole sequence? And do
// things get updates when there is a change in date?" Adding sessions one at
// a time hands your calendar a COPY, and a copy is frozen — when an organiser
// moves a session, the person who added it is the last to know. A
// subscription is the live answer: the calendar re-reads it, and a moved
// session moves.
//
// THE ADDRESS IS ALWAYS SHOWN. It was write-once at first, stored hashed the
// way an API key is. Android broke that: Google Calendar cannot add a
// subscription from its phone app, so the real flow is "press Subscribe on
// the phone, then go to a computer" — and a write-once address is on the
// wrong device by the time you get there. Every calendar service shows you
// your own address whenever you ask. So does this.

import { useState } from 'react';
import { CalendarPlus, Check, Copy, RefreshCw } from 'lucide-react';
import { createCalendar, deleteCalendar, type CalendarStatus } from '@/lib/portal-api';

export function CalendarCard({ status }: { status: CalendarStatus }) {
  const [state, setState] = useState(status);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<CalendarStatus | void>, next?: CalendarStatus) {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const got = await fn();
      setState(got ?? next ?? state);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!state.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
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

      {state.subscribed && state.url && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-sunken p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Your calendar address
          </p>
          {/* Selectable and wrapping. A 64-character token in a one-line box
              that scrolls is a token nobody can copy by hand when the
              clipboard button fails. */}
          <p className="mt-2 break-all font-mono text-xs text-ink">{state.url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={`${button} bg-ink text-surface hover:opacity-90`}>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
            {/* webcal:// hands the address straight to the calendar app.
                Works on Apple; Google ignores it, which is why the Google
                route below is a link to its web page rather than this. */}
            <a
              href={state.webcal ?? state.url}
              className={`${button} border border-line bg-surface text-ink hover:bg-surface-sunken`}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Open in Apple Calendar
            </a>
          </div>

          <div className="mt-4 space-y-2 text-xs text-ink-muted">
            <p>
              <span className="font-medium text-ink">Google Calendar</span> — on
              a computer, open calendar.google.com, then Other calendars → From
              URL and paste this. Its phone app cannot add one, on Android or
              iPhone; once the computer has it, it appears on your phone by
              itself. This page is where the address lives, so open it on the
              computer rather than typing it across.
            </p>
            <p>
              It arrives as its own calendar beside yours. The sessions show up
              in your day, and you cannot edit them — which is what keeps them
              correct.
            </p>
            <p>Keep the address private: anyone who has it can see your sessions.</p>
          </div>
        </div>
      )}

      {state.subscribed && !state.url && (
        // Minted before the address was kept readable. Nothing can recover it.
        <p className="mt-4 text-sm text-ink-muted">
          You have a calendar address from before this page could show it again.
          Make a new one to see it — the old one stops working.
        </p>
      )}

      {state.subscribed && (
        <p className="mt-3 text-xs text-ink-muted">
          {state.last_read_at
            ? `Last collected ${relative(state.last_read_at)}.`
            : 'Nothing has collected it yet — if you just added it, give your calendar an hour.'}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(createCalendar)}
          disabled={busy}
          className={
            state.subscribed
              ? `${button} border border-line bg-surface text-ink hover:bg-surface-sunken`
              : `${button} bg-ink text-surface hover:opacity-90`
          }
        >
          {state.subscribed ? <RefreshCw className="h-4 w-4" aria-hidden /> : <CalendarPlus className="h-4 w-4" aria-hidden />}
          {state.subscribed ? 'Make a new address' : 'Subscribe'}
        </button>
        {state.subscribed && (
          <button
            type="button"
            onClick={() =>
              run(deleteCalendar, {
                subscribed: false,
                created_at: null,
                last_read_at: null,
                url: null,
                webcal: null,
              })
            }
            disabled={busy}
            className="min-h-11 text-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-40"
          >
            Stop the calendar
          </button>
        )}
        {error && <span className="text-sm text-ink-muted">{error}</span>}
      </div>

      {state.subscribed && (
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
