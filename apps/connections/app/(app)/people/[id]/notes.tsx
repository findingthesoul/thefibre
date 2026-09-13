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
import { saveNote, editNote, deleteNote, fetchVocabulary, type NoteKind } from './actions';
import { Timeline, TimelineItem } from '@thefibre/shared/ui/timeline';
import { safely } from '@/lib/safely';
import { QUEUE_CHANGED, currentWorkspace, queueNote, queuedNotes } from '@/lib/offline-notes';
import { TagHighlightBox } from '@/components/tag-highlight-box';
import {
  detectMentions,
  detectTags,
  foldKey,
  highlightRanges,
  type DetectedMention,
  type DetectedTag,
  type KnownPerson,
  type KnownTag,
} from '@/lib/detect-tags';

export type Note = {
  id: string;
  /** The key this note was written under. PUT upserts on it, so an edit
   *  needs it — without it the only way to fix a typo is a second note. */
  client_ref: string;
  body: string;
  happened_tz?: string | null;
  kind: string;
  origin: string;
  happened_at: string;
  follow_up_at: string | null;
  is_draft: boolean;
  created_at: string;
};

/**
 * One conversation on the timeline, and the only place a note can be changed.
 *
 * Sjoerd, 2026-09-13: *"How can I see the note from before? Clicking on it?
 * Can I edit it?"* Clicking it, now — the whole row opens, because a note is
 * a few lines of prose and a pencil icon on something that small is a target
 * people miss.
 *
 * An empty note says so. A note with a follow-up and no words is a legitimate
 * thing to record — "call them next week", nothing to add — and until now it
 * drew as a blank gap, which reads as a bug rather than as a choice.
 */
function Conversation({
  note,
  personId,
  locale,
  onChanged,
}: {
  note: Note;
  personId: string;
  locale: Locale;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const r = await safely(
      () =>
        editNote({
          client_ref: note.client_ref,
          person_id: personId,
          body: draft,
          kind: note.kind as NoteKind,
          // Unchanged on purpose: an edit fixes the words, not when it
          // happened. PUT overwrites the whole row, so leaving this out would
          // silently move the conversation to now.
          happened_at: note.happened_at,
          happened_tz: note.happened_tz ?? null,
          follow_up_at: note.follow_up_at,
        }),
      (error) => ({ ok: false as const, error }),
    );
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const r = await safely(() => deleteNote(note.id), (error) => ({ ok: false as const, error }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onChanged();
  }

  const when = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(note.happened_at));

  const meta = (
    <>
      {/* The browser's zone, not the server's — hence the hydration opt-out
          rather than a mismatch. */}
      <span suppressHydrationWarning>{when}</span>
      {' · '}
      {t(locale, kindKey(note.kind))}
    </>
  );

  if (editing) {
    return (
      <TimelineItem meta={meta}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          autoFocus
          className="w-full rounded-md border border-line bg-surface p-2 text-sm leading-relaxed focus:border-line-strong focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-ink-subtle">{t(locale, 'note_edit_tags_note')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-md border border-line bg-surface-raised px-3 text-sm hover:bg-surface-sunken disabled:opacity-50"
          >
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(note.body);
              setEditing(false);
              setError(null);
            }}
            className="text-xs text-ink-muted hover:text-ink"
          >
            {t(locale, 'cancel')}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto text-xs text-ink-muted hover:text-ink disabled:opacity-50"
          >
            {t(locale, 'delete')}
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-ink">{error}</p>}
      </TimelineItem>
    );
  }

  return (
    <TimelineItem
      meta={meta}
      actions={
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-ink-muted hover:text-ink"
        >
          {t(locale, 'edit')}
        </button>
      }
    >
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full text-left"
        aria-label={t(locale, 'edit')}
      >
        {note.body.trim() ? (
          <span className="whitespace-pre-wrap break-words leading-relaxed">{note.body}</span>
        ) : (
          <span className="text-ink-muted">{t(locale, 'note_no_words')}</span>
        )}
      </button>
      {note.follow_up_at && (
        <p className="mt-1.5 text-xs text-ink-muted" suppressHydrationWarning>
          {t(locale, 'note_followup_on', {
            date: new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium' }).format(
              new Date(note.follow_up_at),
            ),
          })}
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-ink">{error}</p>}
    </TimelineItem>
  );
}

// Explicit map, never a computed `note_kind_${k}` key — the catalog is typed
// so a missing translation is a compile error, and a template key throws
// that guarantee away.
const KIND_KEYS = {
  note: 'note_kind_note',
  call: 'note_kind_call',
  meeting: 'note_kind_meeting',
  encounter: 'note_kind_encounter',
  message: 'note_kind_message',
  email: 'note_kind_email',
} as const;

const KINDS: NoteKind[] = ['note', 'call', 'meeting', 'encounter', 'message', 'email'];

function kindKey(kind: string): (typeof KIND_KEYS)[keyof typeof KIND_KEYS] {
  return KIND_KEYS[kind as NoteKind] ?? KIND_KEYS.note;
}

/**
 * When to come back to this.
 *
 * Sjoerd, 2026-09-13: *"No followup" is default. Dropdown is: week, two
 * weeks, month.. exact date"*. A list rather than three chips, because the
 * chips took a row to themselves and this popup is meant to be read in one
 * glance — and because "nothing planned" being the DEFAULT rather than a
 * third thing to press is the honest arrangement: most notes have no next
 * action, and making somebody say so was asking a question to get the answer
 * it already had.
 */
type FollowUp = 'none' | 'week' | 'two_weeks' | 'month' | 'exact';
/**
 * `offline` is the note being safe ON THIS DEVICE and not yet on the server —
 * deliberately distinct from `saved`, because telling somebody a note is saved
 * when it only exists on a phone that might be dropped in a canal is a lie
 * that costs them the note.
 */
type Status = 'idle' | 'queued' | 'saving' | 'saved' | 'error' | 'offline';

const FOLLOW_UP_KEYS = {
  none: 'note_followup_none',
  week: 'note_followup_week',
  two_weeks: 'note_followup_two_weeks',
  month: 'note_followup_month',
  exact: 'note_followup_exact',
} as const;

const FOLLOW_UPS: FollowUp[] = ['none', 'week', 'two_weeks', 'month', 'exact'];

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

/**
 * The date a choice means, or null for none.
 *
 * `exact` carries its own date, typed into the field the choice reveals; an
 * `exact` with nothing typed is not a follow-up, because half a date is not
 * an answer.
 */
function followUpIso(choice: FollowUp | null, exact: string): string | null {
  if (choice === 'week') {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }
  if (choice === 'two_weeks') {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString();
  }
  if (choice === 'month') return addMonth(new Date()).toISOString();
  if (choice === 'exact') {
    if (!exact) return null;
    const d = new Date(exact);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null; // 'none' and "not answered" are the same write: no follow-up.
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
  const [followUp, setFollowUp] = useState<FollowUp>('none');
  /** "YYYY-MM-DDTHH:mm" local, only meaningful while followUp is 'exact'. */
  const [followUpExact, setFollowUpExact] = useState('');
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
  /** The chip being pointed at, so its word lights up in the sentence. */
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  /** Notes on this device waiting to reach the server, across every person. */
  const [waiting, setWaiting] = useState(0);
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
  /** The last write went to the device queue rather than the server. Read by
   *  commit(), which resets the box and must not then overwrite "saved on
   *  this phone" with a blank status that implies the note went through. */
  const lastQueued = useRef(false);

  // A note is worth keeping if it says something OR plans something. An
  // `exact` with no date typed plans nothing, which followUpIso already
  // decides — so ask it rather than restating the rule here.
  const hasContent = body.trim().length > 0 || followUpIso(followUp, followUpExact) !== null;

  // The waiting count. SENDING is not done here any more: it moved to
  // OfflineSync in the layout, because a note queued in a lift should be sent
  // when the signal returns on ANY page, not only when somebody happens to
  // open a note box. This just keeps the number on screen true.
  useEffect(() => {
    const refresh = () => setWaiting(queuedNotes(currentWorkspace()).length);
    refresh();
    window.addEventListener(QUEUE_CHANGED, refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.removeEventListener(QUEUE_CHANGED, refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);

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
  // Where each tag and mention sits in the sentence, from the SAME detection
  // results the chips show, so the two can never disagree about a word.
  const ranges = highlightRanges(body, tags, mentions);

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
      follow_up_at: followUpIso(followUp, followUpExact),
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

    const body = payload(isDraft);
    let r: Awaited<ReturnType<typeof saveNote>>;
    try {
      r = await saveNote(body);
    } catch {
      // THE CALL ITSELF FAILED — no network. saveNote catches errors raised
      // inside the server function, but a phone that has lost its signal
      // never reaches the server function, so the rejection lands here.
      //
      // Before this catch existed that rejection went nowhere: the status sat
      // on "Saving…" forever, and `committing` stayed true so every later
      // Done was silently ignored until reload. Both are locked by
      // notes.test.tsx.
      //
      // The note is kept on the device instead. It replays through the same
      // PUT, which upserts on client_ref, so sending it later — or twice —
      // updates one row rather than making a second.
      if (generation.current !== myGen) return false;
      if (queueNote(body)) {
        lastQueued.current = true;
        window.dispatchEvent(new Event(QUEUE_CHANGED));
        setStatus('offline');
        return true;
      }
      // Could not even store it locally (storage disabled, quota). Say so
      // and keep the text in the box — never claim it is safe when it is not.
      setStatus('error');
      setFailure(t(locale, 'note_offline_unsaved'));
      return false;
    }

    lastQueued.current = false;
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
  }, [body, kind, when, followUp, followUpExact]);

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
    let ok = false;
    try {
      ok = await write(false);
    } finally {
      // In a `finally`, so NOTHING can leave this set. When write() could
      // throw, one failed commit left `committing` true and every later Done
      // returned at the guard above — the composer locked until reload.
      // write() no longer throws, but a lock that only one code path releases
      // is a lock waiting for the next path.
      committing.current = false;
    }
    if (!ok) return; // keep what they typed; the retry is right there

    generation.current += 1;
    clientRef.current = null;
    firstRender.current = true; // the reset below is not an edit
    setBody('');
    setKind('note');
    setWhen('');
    setFollowUp('none');
    setFollowUpExact('');
    setDetails(false);
    // Queued on the device: the box resets so the person can move on, but the
    // status keeps saying where the note actually is.
    setStatus(lastQueued.current ? 'offline' : 'idle');
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
        {/* The tags are marked INSIDE the sentence as it is typed. The real
            text box is untouched — the tints are painted behind it — so
            typing, autocorrect and the caret behave exactly as before. See
            TagHighlightBox for why that trade was made. */}
        <TagHighlightBox
          value={body}
          onChange={setBody}
          ranges={ranges}
          activeKey={activeKey}
          placeholder={t(locale, 'note_placeholder')}
          ariaLabel={`${t(locale, 'notes_heading')} — ${personName}`}
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
                // Pointing at a chip lights its word in the sentence, so the
                // chip and the highlight read as the same thing. Focus too,
                // not only hover, for keyboards and for touch screens that
                // focus on first tap.
                onMouseEnter={() => setActiveKey(foldKey(m.name))}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(foldKey(m.name))}
                onBlur={() => setActiveKey(null)}
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
                onMouseEnter={() => setActiveKey(foldKey(tag.name))}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(foldKey(tag.name))}
                onBlur={() => setActiveKey(null)}
                title={t(locale, tag.via === 'organisation' ? 'note_tag_org' : 'note_tag_remove')}
                className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-ink bg-ink px-3 text-xs text-ink-inverse"
              >
                {tag.name}
                <X size={12} className="opacity-60 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}

        {/* Follow-up: one control, "nothing planned" already chosen.
            Sjoerd, 2026-09-13: *"\"No followup\" is default. Dropdown is:
            week, two weeks, month.. exact date"*. Three chips took a row to
            themselves in a popup meant to be read at a glance, and asking
            somebody to press "nothing planned" was asking a question to get
            the answer it already had. */}
        {/* ONE row: follow-up always, kind and when when you open them.
            Sjoerd, 2026-09-13: *"Follow up [select] | Kind: [select] | Date :
            [date] can go in 1 row and open..."*. They had been three stacked
            blocks with a rule between them, which is a lot of vertical space
            for three small answers in a popup meant to be read at a glance.

            Kind and when stay behind the disclosure rather than becoming
            always-visible: they are DEFAULTED, and putting three controls on
            screen before somebody has typed a word is the interrogation this
            composer was built to avoid. Opening them now widens the row that
            is already there instead of adding two more. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">{t(locale, 'note_followup')}</span>
            <select
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value as FollowUp)}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs"
            >
              {FOLLOW_UPS.map((f) => (
                <option key={f} value={f}>
                  {t(locale, FOLLOW_UP_KEYS[f])}
                </option>
              ))}
            </select>
          </label>

          {/* The shared date field, not a native input. This app's rule is
              that dates always go through DateField — it carries the locale's
              own ordering and the picker people already know. A native
              `datetime-local` shipped here on 2026-09-13 and was wrong for
              exactly that reason. */}
          {followUp === 'exact' && (
            <div className="min-w-[13rem]">
              <DateTimeField
                value={followUpExact}
                onChange={setFollowUpExact}
                label={undefined}
              />
            </div>
          )}

          {details && (
            <>
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">{t(locale, 'kind')}</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as NoteKind)}
                  className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(locale, KIND_KEYS[k])}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-ink-muted">{t(locale, 'note_when')}</span>
                <span className="min-w-[13rem]">
                  <DateTimeField value={when} onChange={setWhen} label={undefined} />
                </span>
              </label>
            </>
          )}
        </div>

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
              {status === 'offline' && t(locale, 'note_saved_on_device')}
              {status !== 'offline' && waiting > 0 && t(locale, 'note_waiting', { n: waiting })}
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

      {/* The same timeline The Fibre draws for activity — Sjoerd, 2026-09-13:
          *"Is it an idea that the timeline has the same design as the fibre?
          DATE, TYPE .... Content...."* It was the same design already, written
          twice; it is now one component in @thefibre/shared and both read from
          it. */}
      {notes.length > 0 && (
        <Timeline>
          {notes.map((n) => (
            <Conversation
              key={n.id}
              note={n}
              personId={personId}
              locale={locale}
              onChanged={() => (onCommitted ? onCommitted() : router.refresh())}
            />
          ))}
        </Timeline>
      )}
    </div>
  );
}
