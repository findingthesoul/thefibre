'use client';

// "3 changes not sent. 24 people haven't been told."
//
// The other half of the rule that editing is not announcing (Sjoerd,
// 2026-09-24). Moving a session queues; this is where the organiser looks at
// what is owed, says something in their own words, and presses once.
//
// It is a BAR, not a toast and not a dialog. A toast disappears while you are
// still thinking, and a dialog would interrupt the rearranging that produced
// the changes in the first place. A bar waits. That matters because the
// realistic shape of this work is an afternoon of moving things followed by
// one decision at the end.
//
// Deliberately absent: any way to send without reading. The list is the
// screen, not a confirmation on top of it.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Send } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/field';
import { FormError } from '@/components/ui/form-error';
import {
  getCalendarChanges,
  sendCalendarChanges,
  type CalendarChange,
} from '../actions';

export function CalendarTray({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [changes, setChanges] = useState<CalendarChange[]>([]);
  const [audience, setAudience] = useState(0);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Read on mount and whenever the dialog closes: the queue changes through
  // ordinary saves elsewhere on this page, not through anything here.
  useEffect(() => {
    let alive = true;
    void getCalendarChanges(threadId).then((r) => {
      if (!alive) return;
      setChanges(r.changes);
      setAudience(r.audience_count);
    });
    return () => {
      alive = false;
    };
  }, [threadId, open, done]);

  if (!changes.length) return null;

  const n = changes.length;

  function send() {
    setError(null);
    start(async () => {
      const r = await sendCalendarChanges(threadId, note.trim() || null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setNote('');
      setDone(
        r.sent
          ? `Sent to ${r.recipients} ${r.recipients === 1 ? 'person' : 'people'}.`
          : 'Nothing to send — nobody is enrolled yet.',
      );
      setChanges([]);
      router.refresh();
    });
  }

  return (
    <>
      {done && (
        <p className="mb-4 rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-subtle">
          {done}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-sunken px-4 py-3">
        <CalendarClock className="h-5 w-5 shrink-0 text-ink-subtle" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-ink">
          <span className="font-medium">
            {n} {n === 1 ? 'change' : 'changes'} not sent.
          </span>{' '}
          <span className="text-ink-subtle">
            {audience === 0
              ? 'Nobody is enrolled yet.'
              : `${audience} ${audience === 1 ? 'person has' : 'people have'} not been told.`}
          </span>
        </p>
        <Button type="button" onClick={() => setOpen(true)}>
          Review and send
        </Button>
      </div>

      {open && (
        <Dialog
          open
          title="Tell people what changed"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Not yet
              </Button>
              <Button type="button" onClick={send} disabled={pending}>
                <Send className="h-4 w-4" aria-hidden />
                {pending
                  ? 'Sending…'
                  : audience === 0
                    ? 'Mark as told'
                    : `Send to ${audience} ${audience === 1 ? 'person' : 'people'}`}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink-subtle">
            Their calendars update themselves — a moved session moves, a
            cancelled one disappears. This is what they will see written down.
          </p>

          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {changes.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <p className="text-sm font-medium text-ink">
                  <Kind kind={c.kind} /> {c.title}
                </p>
                <Lines change={c} />
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <TextAreaField
              label="Anything to add (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Sorry for the change — the venue was double-booked."
            />
          </div>

          {audience === 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              Nobody is enrolled, so nothing will be sent. Marking these as told
              clears the bar; anyone who joins later gets the current dates
              anyway.
            </p>
          )}

          {error && <FormError message={error} />}
        </Dialog>
      )}
    </>
  );
}

function Kind({ kind }: { kind: CalendarChange['kind'] }) {
  const label = kind === 'added' ? 'New:' : kind === 'moved' ? 'Moved:' : 'Cancelled:';
  return <span className="text-ink-subtle">{label}</span>;
}

/** What changed, in the order a person reads it: what it was, then what it is.
 *  Struck-through on the old value, because a move is recognised at a glance
 *  or not at all. */
function Lines({ change }: { change: CalendarChange }) {
  if (change.kind === 'cancelled') {
    return <p className="mt-0.5 text-xs text-ink-muted">It will disappear from their calendars.</p>;
  }
  const now = when(change.now_state?.starts_at, change.now_state?.ends_at);
  const was = change.kind === 'moved' ? when(change.was?.starts_at, change.was?.ends_at) : null;
  return (
    <p className="mt-0.5 text-xs text-ink-muted">
      {was && <span className="line-through">{was}</span>}
      {was && ' → '}
      {now}
      {change.now_state?.location ? ` · ${change.now_state.location}` : ''}
    </p>
  );
}

function when(startsAt?: string | null, endsAt?: string | null): string {
  if (!startsAt) return 'No date';
  const d = new Date(startsAt);
  const day = d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = (x: Date) => x.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return endsAt ? `${day}, ${time(d)}–${time(new Date(endsAt))}` : `${day}, ${time(d)}`;
}
