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
import { AtSign, Check, SlidersHorizontal, X } from 'lucide-react';
import { DateTimeField } from '@/components/ui/date-field';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { saveNote, fetchVocabulary, type NoteKind } from './actions';
import {
  detectMentions,
  detectTags,
  type DetectedMention,
  type DetectedTag,
  type KnownPerson,
  type KnownTag,
} from '@/lib/detect-tags';

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
  onCommitted,
}: {
  personId: string;
  personName: string;
  notes: Note[];
  locale: Locale;
  /**
   * What to do once a note commits. Defaults to `router.refresh()`, which is
   * right on the person PAGE: the list below is a server component and a
   * refresh re-reads it.
   *
   * In the popup that is wrong. The list there is client state loaded by a
   * server action, so a refresh re-renders whatever page is UNDER the dialog
   * and leaves the list inside it showing the old notes — the person commits
   * a note and watches it not appear. The dialog passes its own reload.
   */
  onCommitted?: () => void;
}) {
  const router = useRouter();

  const [body, setBody] = useState('');
  const [kind, setKind] = useState<NoteKind>('note');
  /** "YYYY-MM-DDTHH:mm" local, or '' meaning "now" — decided by the API. */
  const [when, setWhen] = useState('');
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [details, setDetails] = useState(false);
  /**
   * Words this workspace already uses — its tags and the names of the
   * organisations it holds. Fetched once per composer and held here, because
   * detection runs on every keystroke and a round trip per keystroke would be
   * both slow and a way to send a half-written sentence to a server.
   */
  const [vocabulary, setVocabulary] = useState<KnownTag[]>([]);
  /**
   * People this workspace knows, for `@` only.
   *
   * Held in its own state rather than merged into `vocabulary`, and that is
   * the guarantee rather than a preference: detectTags takes `vocabulary` and
   * has no parameter these could reach. Matching a name in prose is a guess;
   * `@` is somebody choosing from a list.
   */
  const [mentionable, setMentionable] = useState<KnownPerson[]>([]);
  /**
   * Tags the person has taken off. Sjoerd, 2026-09-12: *"clicking it can also
   * X the tag and keep it as a word"* — removing a tag must not remove the
   * word from the sentence, and re-typing the word must not bring the tag
   * back, or the X would not be a decision, only a delay. Keyed by folded
   * name so a different capitalisation is the same refusal.
   */
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
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

  useEffect(() => {
    let alive = true;
    fetchVocabulary()
      .then((v) => {
        if (!alive) return;
        setVocabulary(v.words);
        setMentionable(v.people);
      })
      // Silent: without the vocabulary nothing is detected and the composer
      // is exactly the composer it was before this feature. A banner would
      // make a working note-taking box look broken over a missing garnish.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const tags: DetectedTag[] = detectTags(body, vocabulary).filter(
    (t) => !dismissed.has(t.name.toLowerCase()),
  );

  // `@` — people and organisations, resolved from what was typed. An
  // organisation mention is already a tag (an organisation IS a
  // characteristic of the people in it), so only PEOPLE need their own list;
  // the organisation ones are folded in with the tags below.
  const mentions: DetectedMention[] = detectMentions(body, mentionable, vocabulary).filter(
    (m) => !dismissed.has(`@${m.name.toLowerCase()}`),
  );
  const peopleMentioned = mentions.filter((m) => m.kind === 'person');
  const orgsMentioned = mentions.filter((m) => m.kind === 'organisation');

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
      // Only what is on screen right now. The API applies this list rather
      // than re-detecting, so what the person SAW is what gets written —
      // including the ones they took off.
      tags: [
        ...tags.map((t) => ({
          name: t.name,
          ...(t.organisationId ? { organisation_id: t.organisationId } : {}),
        })),
        // An @organisation becomes a tag like any other organisation word.
        ...orgsMentioned.map((m) => ({ name: m.name, organisation_id: m.id })),
      ],
      mentions: peopleMentioned.map((m) => m.id),
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
    // The committed note joins the list below.
    if (onCommitted) onCommitted();
    else router.refresh();
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

        {/* Tags found in what was just written.
            
            They appear ON, not as a suggestion to accept, because the whole
            request was that this happen "without you having to do it" — a row
            of things to confirm would be another form. The X is the decision
            that matters, and it takes the TAG off while leaving the WORD in
            the sentence, which is the distinction Sjoerd drew.
            
            Nothing here blocks: a note with every tag removed saves exactly
            like a note with none found. */}
        {/* People named with @. Separate from the tags, because they are a
            different thing: a tag is a characteristic somebody carries, a
            mention is that they were in this conversation. */}
        {peopleMentioned.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted">{t(locale, 'note_also_here')}</span>
            {peopleMentioned.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setDismissed((d) => new Set(d).add(`@${m.name.toLowerCase()}`))
                }
                title={t(locale, 'note_mention_remove')}
                className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface-sunken px-3 text-xs"
              >
                <AtSign size={12} className="text-ink-subtle" />
                {m.name}
                <X size={12} className="opacity-60 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted">{t(locale, 'note_tags')}</span>
            {tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                onClick={() =>
                  setDismissed((d) => new Set(d).add(tag.name.toLowerCase()))
                }
                title={t(locale, tag.via === 'organisation' ? 'note_tag_org' : 'note_tag_remove')}
                className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-ink bg-ink px-3 text-xs text-ink-inverse"
              >
                {tag.name}
                <X size={12} className="opacity-60 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}

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
