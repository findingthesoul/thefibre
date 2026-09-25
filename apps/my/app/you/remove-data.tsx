'use client';

// Removing your data, from your own page.
//
// The right exists whether or not there is a button for it; what a button
// changes is that somebody does not have to find an address to write to.
//
// WHAT THIS SCREEN IS FOR, and it is not the button. It is the three
// sentences above it. Sjoerd asked the question that shaped this — *"what
// happens if someone requests removal but they have a seat, are organising
// threads in the future?"* — and the answer is that a person is entitled to
// know all of that BEFORE they ask, not to discover it in a reply three weeks
// later. So the page says what goes, what is kept whatever anyone asks, and
// what is blocked because other people are standing on it.
//
// Nothing here deletes anything. It files a request, a person reads it, and
// the thirty-day clock is in the law rather than in our diary. Anything that
// LOOKED instant would be a lie: these tables are append-only by design and
// erasure across them is anonymisation with a design behind it.

import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { requestErasure, type ErasurePicture } from '@/lib/portal-api';

export function RemoveData({ picture }: { picture: ErasurePicture }) {
  const [state, setState] = useState(picture);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      setState(await requestErasure(reason.trim() || null));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not send.');
    } finally {
      setBusy(false);
    }
  }

  const blocked = state.blocked.upcoming_threads > 0;

  if (state.pending) {
    return (
      <section className="mt-10 border-t border-line pt-6">
        <h2 className="text-sm font-medium text-ink">Removing your data</h2>
        <p className="mt-1 text-sm text-ink-muted">
          You asked on {day(state.pending.requested_at)}. Someone has to answer
          by {day(state.pending.due_at)}, and will write to you at this address.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-sm font-medium text-ink">Removing your data</h2>
      <p className="mt-1 text-sm text-ink-muted">
        You can ask for everything we hold about you to be removed. Here is
        what that means, before you decide.
      </p>

      <dl className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-sm">
        <Row
          label="Would be removed"
          value={removesLine(state.removes)}
        />
        {state.kept.invoices > 0 && (
          <Row
            label="Kept anyway"
            value={`${state.kept.invoices} ${state.kept.invoices === 1 ? 'invoice' : 'invoices'}`}
            note="Invoices are financial records. We are required to keep them for several years, and that is not something anyone here can waive."
          />
        )}
        {blocked && (
          <Row
            label="Has to be sorted first"
            value={`${state.blocked.upcoming_threads} ${
              state.blocked.upcoming_threads === 1 ? 'thread' : 'threads'
            } you organise`}
            note={`${state.blocked.participants_affected} ${
              state.blocked.participants_affected === 1 ? 'person is' : 'people are'
            } enrolled in ${state.blocked.upcoming_threads === 1 ? 'it' : 'them'}. Their place depends on your account, and your name is on what they have been sent. Those threads need handing to someone else or closing before your account can go${
              state.blocked.workspaces.length
                ? ` — in ${state.blocked.workspaces.join(', ')}`
                : ''
            }. We will say so when we reply; you do not have to sort it out first.`}
          />
        )}
      </dl>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-medium text-ink hover:bg-surface-sunken"
        >
          <ShieldOff className="h-4 w-4" aria-hidden />
          Ask for my data to be removed
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-line bg-surface-sunken p-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Anything you want to say (optional)
            </span>
            <textarea
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-line-strong focus:outline-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="I no longer want an account here."
            />
          </label>
          <p className="mt-2 text-xs text-ink-muted">
            This sends a request to a person, who has thirty days to answer and
            will write to you at this address. Nothing is deleted the moment
            you press it.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-lg bg-ink px-5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send the request'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="min-h-11 text-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-40"
            >
              Not now
            </button>
            {error && <span className="text-sm text-ink-muted">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-ink-muted">{label}</dt>
        <dd className="min-w-0 text-right text-ink">{value}</dd>
      </div>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

/** Counted in the things a person recognises — places they took, calls they
 *  had, communities they joined — rather than in table names. */
function removesLine(r: ErasurePicture['removes']): string {
  const parts = [
    r.enrolments ? `${r.enrolments} ${r.enrolments === 1 ? 'enrolment' : 'enrolments'}` : null,
    r.bookings ? `${r.bookings} ${r.bookings === 1 ? 'booking' : 'bookings'}` : null,
    r.memberships ? `${r.memberships} ${r.memberships === 1 ? 'membership' : 'memberships'}` : null,
  ].filter(Boolean) as string[];
  if (!parts.length) return 'Your details';
  return `${parts.join(', ')}, and your details`;
}

function day(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
