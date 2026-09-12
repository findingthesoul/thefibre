'use client';

// The composer, and what has been said before it.
//
// Capture rules (connections data integrity §7), all of them visible in this
// file because they are interface behaviour, not API behaviour:
//
//   - AUTOSAVE. No save button. Typing schedules a write 800ms later; the
//     client mints one uuid per note and sends it as `client_ref` on every
//     write, so every autosave, retry and double-submit upserts the SAME row.
//   - A DRAFT IS A REAL STATE. Writes carry is_draft:true while the box has
//     focus. Committing (focus leaves the composer, or Done) sends
//     is_draft:false, and that transition — server-side — is what files the
//     activity row. Never per keystroke.
//   - DEFAULT EVERYTHING, ASK NOTHING. One text box and a name. `kind` is a
//     note and `happened_at` is now until somebody opens the small control
//     and says otherwise. Nothing is asked up front.
//   - OFFER THE NEXT ACTION, DO NOT BLOCK ON IT. Three follow-up chips, none
//     preselected. Walking away without choosing is a legitimate answer and
//     produces no warning, no modal, no held-open dialog.
//   - SAY WHAT IS TRUE. "Saved" appears only after a write came back and no
//     newer edit is waiting. In flight says saving, waiting says queued, and
//     a failure says so and offers the retry.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, SlidersHorizontal } from 'lucide-react';
import { DateTimeField } from '@/components/ui/date-field';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { saveNote, type NoteKind } from './actions';

export type Note = {
  id: string;
  body: string;
  kind: string;
  origin: string;
  happened_at: string;
  follow_up_at: string | null;
  is_draft: boolean;
  created_at: string;
};

// Explicit map, never a computed `note_kind_${k}` key — the catalog is typed
// so a missing translation is a compile error, and a template key throws
// that guarantee away.
const KIND_KEYS = {
  note: 'note_kind_note',
  call: 'note_kind_call',
  meeting: 'note_kind_meeting',
  message: 'note_kind_message',
  email: 'note_kind_email',
} as const;

const KINDS: NoteKind[] = ['note', 'call', 'meeting', 'message', 'email'];

function kindKey(kind: string): (typeof KIND_KEYS)[keyof typeof KIND_KEYS] {
  return KIND_KEYS[kind as NoteKind] ?? KIND_KEYS.note;
}

type FollowUp = 'week' | 'month' | 'none';
type Status = 'idle' | 'queued' | 'saving' | 'saved' | 'error';

/** Adding a month to the 31st must not land in the month after next. */
function addMonth(from: Date): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

function followUpIso(choice: FollowUp | null): string | null {
  if (choice === 'week') {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }
  if (choice === 'month') return addMonth(new Date()).toISOString();
  return null; // 'none' and "not answered" are the same write: no follow-up.
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
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 rounded-full border px-3 text-xs transition-colors ${
        active
          ? 'border-ink bg-ink text-ink-inverse'
          : 'border-line bg-surface-raised text-ink-subtle hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export function Notes({
  personId,
  personName,
  notes,
  locale,
}: {
  personId: string;
  personName: string;
  notes: Note[];
  locale: Locale;
}) {
  const router = useRouter();

  const [body, setBody] = useState('');
  const [kind, setKind] = useState<NoteKind>('note');
  /** "YYYY-MM-DDTHH:mm" local, or '' meaning "now" — decided by the API. */
  const [when, setWhen] = useState('');
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [details, setDetails] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  // One key per note, minted at the first write and reused by every write
  // after it. Cleared on commit so the next note is a new row.
  const clientRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped on every edit; a write that finishes behind a newer edit must
   *  not claim "saved". */
  const seq = useRef(0);
  /** Bumped when the composer resets; an in-flight write from the previous
   *  note must not touch the new one's status. */
  const generation = useRef(0);
  const committing = useRef(false);
  const firstRender = useRef(true);

  const hasContent = body.trim().length > 0 || followUp === 'week' || followUp === 'month';

  function payload(isDraft: boolean) {
    if (!clientRef.current) clientRef.current = crypto.randomUUID();
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = undefined;
    }
    return {
      client_ref: clientRef.current,
      person_id: personId,
      body,
      kind,
      ...(when ? { happened_at: new Date(when).toISOString() } : {}),
      ...(tz ? { happened_tz: tz } : {}),
      follow_up_at: followUpIso(followUp),
      is_draft: isDraft,
    };
  }

  async function write(isDraft: boolean): Promise<boolean> {
    const mySeq = seq.current;
    const myGen = generation.current;
    setStatus('saving');
    setFailure(null);

    const r = await saveNote(payload(isDraft));

    if (generation.current !== myGen) return r.ok; // this note is gone; say nothing
    if (!r.ok) {
      setStatus('error');
      setFailure(r.error);
      return false;
    }
    // A newer keystroke landed while this was in flight — the next timer
    // owns the truth, and "saved" would be a lie until it runs.
    if (seq.current !== mySeq) {
      setStatus('queued');
      return true;
    }
    setStatus(isDraft ? 'saved' : 'idle');
    return true;
  }

  // The debounce. Re-running on every field change (and cancelling the
  // previous timer) IS the 800ms window; each run closes over the settled
  // values, so the write always carries the latest text.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!hasContent) {
      setStatus('idle');
      return;
    }
    seq.current += 1;
    setStatus('queued');
    timer.current = setTimeout(() => {
      timer.current = null;
      void write(true);
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    // `write` is intentionally not a dep: it is recreated every render and
    // the effect already re-runs on everything it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, kind, when, followUp]);

  /** Focus left the composer, or Done was pressed. This is what commits. */
  async function commit() {
    if (committing.current) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // An empty box that was never typed in is not a conversation. Nothing is
    // written, nothing is warned about.
    if (!hasContent) {
      setStatus('idle');
      return;
    }
    committing.current = true;
    const ok = await write(false);
    committing.current = false;
    if (!ok) return; // keep what they typed; the retry is right there

    generation.current += 1;
    clientRef.current = null;
    firstRender.current = true; // the reset below is not an edit
    setBody('');
    setKind('note');
    setWhen('');
    setFollowUp(null);
    setDetails(false);
    setStatus('idle');
    router.refresh(); // the committed note joins the list below
  }

  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  const dateOnly = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <div className="mt-8">
      {/* ── the composer ─────────────────────────────────────────────── */}
      <div
        onBlur={(e) => {
          // Only when focus leaves the whole composer — moving between the
          // box, the chips and Done is not "finished".
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit();
        }}
        className="rounded-lg border border-line bg-surface-raised p-3 sm:p-4"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={t(locale, 'note_placeholder')}
          aria-label={`${t(locale, 'notes_heading')} — ${personName}`}
          className="w-full resize-y bg-transparent text-sm leading-relaxed placeholder:text-ink-muted focus:outline-none"
        />

        {/* Follow-up: three taps, nothing preselected, closing without one
            is allowed. Tapping the chosen chip again unchooses it. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">{t(locale, 'note_followup')}</span>
          <Chip active={followUp === 'week'} onClick={() => setFollowUp(followUp === 'week' ? null : 'week')}>
            {t(locale, 'note_followup_week')}
          </Chip>
          <Chip
            active={followUp === 'month'}
            onClick={() => setFollowUp(followUp === 'month' ? null : 'month')}
          >
            {t(locale, 'note_followup_month')}
          </Chip>
          <Chip active={followUp === 'none'} onClick={() => setFollowUp(followUp === 'none' ? null : 'none')}>
            {t(locale, 'note_followup_none')}
          </Chip>
        </div>

        {/* Kind and when: defaulted, editable, never asked. */}
        {details && (
          <div className="mt-3 space-y-3 border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-muted">{t(locale, 'kind')}</span>
              {KINDS.map((k) => (
                <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                  {t(locale, KIND_KEYS[k])}
                </Chip>
              ))}
            </div>
            <DateTimeField label={t(locale, 'note_when')} value={when} onChange={setWhen} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDetails((d) => !d)}
              aria-expanded={details}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
            >
              <SlidersHorizontal size={13} strokeWidth={1.75} />
              {t(locale, 'note_change')}
            </button>

            {/* Honest state. Never "saved" while something is in flight. */}
            <span className="text-xs text-ink-muted" aria-live="polite">
              {status === 'queued' && t(locale, 'note_queued')}
              {status === 'saving' && t(locale, 'note_saving')}
              {status === 'saved' && t(locale, 'note_saved_draft')}
              {status === 'error' && (
                <span className="text-red-700 dark:text-red-400">
                  {t(locale, 'note_save_failed')}
                  {failure ? ` — ${failure}` : ''}{' '}
                  <button
                    type="button"
                    onClick={() => void write(true)}
                    className="underline hover:no-underline"
                  >
                    {t(locale, 'note_try_again')}
                  </button>
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void commit()}
            disabled={!hasContent}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-xs font-medium text-ink-inverse transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Check size={13} strokeWidth={2.25} />
            {t(locale, 'done')}
          </button>
        </div>
      </div>

      {/* ── what was said before ─────────────────────────────────────── */}
      <h2 className="mt-8 text-sm font-medium">
        {t(locale, 'notes_heading')}
        {notes.length > 0 && <span className="ml-2 text-ink-muted tabular-nums">{notes.length}</span>}
      </h2>

      {notes.length === 0 && <p className="mt-2 text-sm text-ink-muted">{t(locale, 'notes_none')}</p>}

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-line bg-surface-raised px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{t(locale, kindKey(n.kind))}</span>
                {/* The browser's zone, not the server's — hence the
                    hydration opt-out rather than a mismatch. */}
                <span className="text-xs text-ink-muted tabular-nums" suppressHydrationWarning>
                  {dateTime(n.happened_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{n.body}</p>
              {n.follow_up_at && (
                <p className="mt-1.5 text-xs text-ink-muted" suppressHydrationWarning>
                  {t(locale, 'note_followup_on', { date: dateOnly(n.follow_up_at) })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
