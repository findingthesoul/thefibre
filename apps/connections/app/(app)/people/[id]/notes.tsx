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
//     note and `happened_at` is now. Nothing is asked up front.
//   - OFFER THE NEXT ACTION, DO NOT BLOCK ON IT. Three follow-up chips, none
//     preselected. Walking away without choosing is a legitimate answer and
//     produces no warning, no modal, no held-open dialog.
//   - SAY WHAT IS TRUE. "Saved" appears only after a write came back and no
//     newer edit is waiting. In flight says saving, waiting says queued, and
//     a failure says so and offers the retry.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, Check, ClipboardCopy, X } from 'lucide-react';
import { meetingPrompt } from '@/lib/meeting-prompt';
import { applySuggestion, lookup, type ActiveToken, type Suggestion } from '@/lib/autocomplete';
import { DateField, DateTimeField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { FIELD_CLASS, FIELD_LABEL_CLASS, SelectField } from '@thefibre/shared/ui/fields';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import {
  saveNote,
  editNote,
  deleteNote,
  fetchVocabulary,
  loadMyTeams,
  setDefaultTeam,
  type MyTeam,
  type NoteKind,
} from './actions';
import { Timeline, TimelineItem } from '@thefibre/shared/ui/timeline';
import { safely } from '@/lib/safely';
import { QUEUE_CHANGED, currentWorkspace, queueNote, queuedNotes } from '@/lib/offline-notes';
import { HighlightedText, TagHighlightBox } from '@/components/tag-highlight-box';
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
  /** The team it is filed under, if any. Read back so an edit can keep it. */
  team_id?: string | null;
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
  vocabulary,
  mentionable,
}: {
  note: Note;
  personId: string;
  locale: Locale;
  onChanged: () => void;
  /** The same words and people the composer detects against. */
  vocabulary: KnownTag[];
  mentionable: KnownPerson[];
}) {
  // Detection counts a word only once something follows it, so a tag that
  // ends a saved note would never light up. A trailing space settles that
  // without moving any range: every index it produces is inside the body.
  const readBody = `${note.body} `;
  const noteRanges = highlightRanges(
    readBody,
    detectTags(readBody, vocabulary),
    detectMentions(readBody, mentionable, vocabulary),
  ).filter((r) => r.end <= note.body.length);
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
          // Kept as it was. Leaving it out would take the note out of its
          // team's update meeting for the sake of fixing a word.
          team_id: note.team_id ?? null,
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

  // A date, not a time — Sjoerd, 2026-09-14: "Time may not be so relevant".
  const when = new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium' }).format(
    new Date(note.happened_at),
  );

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
          className={`${FIELD_CLASS} leading-relaxed`}
        />
        <p className="mt-1.5 text-xs text-ink-subtle">{t(locale, 'note_edit_tags_note')}</p>
        {/* The Fibre's bottom-bar order: Delete left, Cancel · Save right. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy}>
            {t(locale, 'delete')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setDraft(note.body);
              setEditing(false);
              setError(null);
            }}
          >
            {t(locale, 'cancel')}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
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
          <span className="whitespace-pre-wrap break-words leading-relaxed">
            <HighlightedText text={note.body} ranges={noteRanges} />
          </span>
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

/**
 * What the follow-up will be. Not stored on the note: the follow-up becomes a
 * task in "what you owe", and this is that task's title.
 */
type FollowUpKind = 'touch' | 'call' | 'email' | 'meet' | 'message';
const FOLLOW_UP_KINDS: FollowUpKind[] = ['touch', 'call', 'email', 'meet', 'message'];
const FOLLOW_UP_KIND_KEYS = {
  touch: 'fu_kind_touch',
  call: 'fu_kind_call',
  email: 'fu_kind_email',
  meet: 'fu_kind_meet',
  message: 'fu_kind_message',
} as const;

/** "YYYY-MM-DDTHH:mm" in local time — the shape DateTimeField holds. */
export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

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
export type FollowUp =
  | 'none'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'week'
  | 'two_weeks'
  | 'month'
  | 'exact';
/**
 * `offline` is the note being safe ON THIS DEVICE and not yet on the server —
 * deliberately distinct from `saved`, because telling somebody a note is saved
 * when it only exists on a phone that might be dropped in a canal is a lie
 * that costs them the note.
 */
type Status = 'idle' | 'queued' | 'saving' | 'saved' | 'error' | 'offline';

/** The reader's language, named for the assistant the prompt is pasted into. */
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
  pt: 'Portuguese',
  de: 'German',
  fr: 'French',
};

const FOLLOW_UP_KEYS = {
  none: 'note_followup_none',
  today: 'note_followup_today',
  tomorrow: 'note_followup_tomorrow',
  this_week: 'note_followup_this_week',
  week: 'note_followup_week',
  two_weeks: 'note_followup_two_weeks',
  month: 'note_followup_month',
  exact: 'note_followup_exact',
} as const;

/**
 * The follow-ups the LIST offers. `exact` is deliberately not one of them:
 * Sjoerd, 2026-09-14 — *"there is 'on a date'. We just need a date icon"* — so a
 * picked date is reached through the calendar button beside the list, and only
 * appears in the list while one is chosen (so the list can show what is set).
 *
 * Today, tomorrow and this week added the same day, at his ask: the shortest
 * horizons are the ones somebody reaches for straight after a call.
 */
const FOLLOW_UPS: FollowUp[] = ['none', 'today', 'tomorrow', 'this_week', 'week', 'two_weeks', 'month'];

/** Local time at an hour on a given day. */
function at(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

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
export function followUpIso(
  choice: FollowUp | null,
  exact: string,
  now = new Date(),
): string | null {
  // The short horizons land at a working hour rather than at "now plus a
  // day", because a follow-up due at 23:14 tomorrow is a follow-up nobody
  // will see as due until the day after.
  if (choice === 'today') {
    // End of the working day — or right now if that has already passed, so a
    // late-evening "today" is due, not scheduled into the past.
    const end = at(now, 17);
    return (end > now ? end : now).toISOString();
  }
  if (choice === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return at(d, 9).toISOString();
  }
  if (choice === 'this_week') {
    // Friday at the end of the day. On a Friday afternoon, a Saturday or a
    // Sunday "this week" has nowhere left to go, so it means today.
    const dow = now.getDay(); // 0 Sunday … 6 Saturday
    // The weekend first, and explicitly. The first version computed "days to
    // Friday" as `dow <= 5 ? 5 - dow : 0`, which sent a SUNDAY to the
    // following Friday (0 is <= 5) and a Saturday to 17:00 that Saturday —
    // both contradicting this comment, and caught by the test before it
    // shipped.
    if (dow === 0 || dow === 6) return now.toISOString();
    const toFriday = 5 - dow;
    const friday = new Date(now);
    friday.setDate(friday.getDate() + toFriday);
    const end = at(friday, 17);
    return (end > now ? end : now).toISOString();
  }
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
  /**
   * The `#` / `@` word under the caret, and which suggestion is highlighted.
   * Sjoerd, 2026-09-14: *"if I start with the hashtag... hashtag f, that it
   * shows in a drop down some of the options... And with the @, the company
   * or the people"*. The rules for what counts live in lib/autocomplete.ts,
   * tested on their own.
   */
  const [caret, setCaret] = useState(0);
  const [pickIndex, setPickIndex] = useState(0);
  /** Escape closes the list for THIS word only; typing on reopens it. */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  /**
   * "From a meeting": a bigger box and a prompt to take to an AI assistant.
   * Sjoerd, 2026-09-14 — see lib/meeting-prompt.ts for what the prompt
   * carries and, more to the point, what it deliberately does not.
   */
  const [meeting, setMeeting] = useState(false);
  /**
   * Which of my teams this note is filed under. Sjoerd, 2026-09-14: *"I'm
   * automatically selected... when I do what happened, I can open it, and then
   * I can see the teams I am part of... I can have a default team"*.
   *
   * Preselected to my default once the teams arrive, and left alone after a
   * commit — the next note is usually for the same team.
   */
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [kind, setKind] = useState<NoteKind>('note');
  /**
   * The day it happened, "YYYY-MM-DD", today by default. A date, not a time.
   * Sjoerd, 2026-09-14: *"with the When: default the now date"*… *"Time may
   * not be so relevant by the way… take it out... just date"*. Today is sent
   * as the actual moment of writing (so same-day notes still sort in order);
   * another day is sent as noon, which lands on that date in any nearby zone.
   */
  const [happenedOn, setHappenedOn] = useState(() => localStamp(new Date()).slice(0, 10));
  /** Remounts the uncontrolled DateField when the composer resets. */
  const [whenKey, setWhenKey] = useState(0);
  const [followUp, setFollowUp] = useState<FollowUp>('none');
  const [followUpKind, setFollowUpKind] = useState<FollowUpKind>('touch');
  /** "YYYY-MM-DDTHH:mm" local, only meaningful while followUp is 'exact'. */
  const [followUpExact, setFollowUpExact] = useState('');
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
    void loadMyTeams().then((mine) => {
      if (!alive) return;
      setTeams(mine);
      setTeamId(mine.find((t) => t.is_default)?.id ?? null);
    });
    return () => {
      alive = false;
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

  // A word or a short phrase (spaces allowed, up to three words) — see lookup().
  const looked = lookup(body, caret, vocabulary, mentionable);
  const token: ActiveToken | null = looked?.token ?? null;
  const suggestions: Suggestion[] = looked && dismissedAt !== looked.token.start ? looked.suggestions : [];
  const listOpen = suggestions.length > 0;

  function pick(sug: Suggestion) {
    if (!token) return;
    const next = applySuggestion(body, token, sug);
    setBody(next.text);
    setCaret(next.caret);
    setPickIndex(0);
    // Put the caret where the insert ended. The textarea is controlled, so the
    // new value lands on the next render — the caret has to wait for it.
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      }
    });
  }

  function onBoxKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!listOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPickIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPickIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      // Enter normally makes a new line in the note; while the list is open it
      // picks instead, which is what every autocomplete people know does.
      e.preventDefault();
      const sug = suggestions[Math.min(pickIndex, suggestions.length - 1)];
      if (sug) pick(sug);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (token) setDismissedAt(token.start);
    }
  }

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
      team_id: teamId,
      body,
      kind,
      ...(tz ? { happened_tz: tz } : {}),
      ...(happenedOn && happenedOn !== localStamp(new Date()).slice(0, 10)
        ? { happened_at: new Date(`${happenedOn}T12:00`).toISOString() }
        : {}),
      follow_up_at: followUpIso(followUp, followUpExact),
      // The follow-up becomes a task; this is its title, in the writer's language.
      follow_up_title: t(locale, FOLLOW_UP_KIND_KEYS[followUpKind]),
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
  }, [body, kind, happenedOn, followUp, followUpKind, followUpExact]);

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
    setHappenedOn(localStamp(new Date()).slice(0, 10));
    setWhenKey((k) => k + 1);
    setFollowUp('none');
    setFollowUpKind('touch');
    setFollowUpExact('');
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
      >
        {/* THE SHARED FORM, not a style of its own. Sjoerd, 2026-09-14,
            comparing this box with Thread's editor: *"Why do we have two
            styles. It should be - as we agreed - one single point of truth...
            now we have two"* and *"The Thread is way more clear"*. Labels above,
            SelectField / DateTimeField / Button from @thefibre/shared — the same
            controls Thread uses — and no hand-written heights or tints. Where a
            control cannot be a shared field (the highlighted text box), it
            takes FIELD_CLASS from the same module rather than its own classes.

            Order, top to bottom: what happened and when, what was said, what
            comes next. "When" is a date, today by default. */}
        <div className={`grid gap-4 ${teams.length > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <SelectField
            label={t(locale, 'kind')}
            value={kind}
            onChange={(e) => setKind(e.target.value as NoteKind)}
            options={KINDS.map((k) => ({ value: k, label: t(locale, KIND_KEYS[k]) }))}
          />
          <DateField
            key={whenKey}
            label={t(locale, 'note_when')}
            name="happened_on"
            required
            defaultValue={happenedOn}
            onValueChange={setHappenedOn}
          />
          {/* A team only when there IS a team to choose: most workspaces never
              use teams this way. */}
          {teams.length > 0 && (
            <SelectField
              label={t(locale, 'team_field')}
              value={teamId ?? ''}
              onChange={(e) => setTeamId(e.target.value || null)}
              options={[
                { value: '', label: t(locale, 'team_none') },
                ...teams.map((tm) => ({
                  value: tm.id,
                  label: tm.is_default ? `${tm.name} · ${t(locale, 'team_default')}` : tm.name,
                })),
              ]}
              hint={
                // Offered only when the choice differs from the default.
                teamId !== (teams.find((tm) => tm.is_default)?.id ?? null) ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await safely(
                        () => setDefaultTeam(teamId),
                        (error) => ({ ok: false as const, error }),
                      );
                      if (r.ok) setTeams((prev) => prev.map((tm) => ({ ...tm, is_default: tm.id === teamId })));
                    }}
                    className="underline-offset-2 hover:text-ink hover:underline"
                  >
                    {t(locale, teamId ? 'team_make_default' : 'team_clear_default')}
                  </button>
                ) : undefined
              }
            />
          )}
        </div>

        {/* The tags are marked INSIDE the sentence as it is typed. The real
            text box is untouched — the tints are painted behind it — so
            typing, autocorrect and the caret behave exactly as before. See
            TagHighlightBox for why that trade was made. */}
        <div className="mt-4">
          <span className={FIELD_LABEL_CLASS}>{t(locale, 'note_body_label')}</span>
          <div className={`mt-1 ${FIELD_CLASS} focus-within:border-line-strong`}>
        <TagHighlightBox
          rows={meeting ? 10 : 3}
          value={body}
          onChange={(v) => {
            setBody(v);
            setPickIndex(0);
            // The moment somebody starts writing is when it happened, unless
            // they say otherwise.
          }}
          textareaRef={boxRef}
          onKeyDown={onBoxKey}
          onCaret={(c) => {
            setCaret(c);
            // Moving to a different word forgets an Escape on the last one.
            if (dismissedAt !== null && lookup(body, c, vocabulary, mentionable)?.token.start !== dismissedAt) {
              setDismissedAt(null);
            }
          }}
          ranges={ranges}
          activeKey={activeKey}
          placeholder={t(locale, 'note_placeholder')}
          ariaLabel={`${t(locale, 'notes_heading')} — ${personName}`}
        />
          </div>
        </div>

        {/* From a meeting. Sjoerd, 2026-09-14: *"a proper prompt that someone
            could paste into their ChatGPT or Claude or Gemini... and that
            summary could be pasted in the what happened"*.

            This app does not call an AI itself. The person takes the prompt to
            the assistant THEY already use, with a transcript they already
            have, and brings back a short note — so no transcript is ever sent
            anywhere by The Fibre, and nobody has to hand this platform a key to
            a service it does not run. */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setMeeting((m) => !m)}
            aria-expanded={meeting}
            className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {t(locale, meeting ? 'meeting_close' : 'meeting_open')}
          </button>
          {meeting && (
            <div className="mt-2 rounded-md border border-line bg-surface px-3 py-2.5 text-xs text-ink-muted">
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>{t(locale, 'meeting_step_copy')}</li>
                <li>{t(locale, 'meeting_step_paste')}</li>
                <li>{t(locale, 'meeting_step_back')}</li>
              </ol>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const text = meetingPrompt({
                      personName,
                      languageName: LANGUAGE_NAMES[locale],
                      // Topic tags only. Organisation words are left out on
                      // purpose — see the header of lib/meeting-prompt.ts.
                      topicTags: vocabulary.filter((w) => !w.organisationId).map((w) => w.name),
                    });
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopied('copied');
                    } catch {
                      // A browser that refuses the clipboard should not leave
                      // somebody thinking it worked.
                      setCopied('failed');
                    }
                    setTimeout(() => setCopied('idle'), 2500);
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-raised px-3 text-sm text-ink hover:bg-surface-sunken"
                >
                  <ClipboardCopy size={14} strokeWidth={1.75} />
                  {t(locale, 'meeting_copy')}
                </button>
                {copied === 'copied' && <span className="inline-flex items-center gap-1"><Check size={13} /> {t(locale, 'meeting_copied')}</span>}
                {copied === 'failed' && <span className="text-ink">{t(locale, 'meeting_copy_failed')}</span>}
              </div>
              <p className="mt-2 text-ink-subtle">{t(locale, 'meeting_privacy')}</p>
            </div>
          )}
        </div>

        {/* `#` and `@` suggestions for the word under the caret.

            IN THE FLOW, not floating. This composer lives inside a dialog, and
            a floating list opens into the dialog's bottom edge and is clipped
            — the exact bug the organisation popup shipped with on 2026-09-13.
            Pushing the controls down for a moment is the lesser cost.

            `onMouseDown` prevents the textarea losing focus before the click
            lands, so picking with the mouse keeps the caret in the note. */}
        {listOpen && (
          <ul
            role="listbox"
            aria-label={t(locale, token?.trigger === '#' ? 'ac_tags' : 'ac_people')}
            className="mt-1 max-h-48 overflow-y-auto rounded-md border border-line bg-surface py-1"
          >
            {suggestions.map((sug, i) => (
              <li
                key={`${sug.isNew ? 'new' : sug.kind}:${sug.id ?? sug.name}`}
                role="option"
                aria-selected={i === pickIndex}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setPickIndex(i)}
                  onClick={() => pick(sug)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                    i === pickIndex ? 'bg-surface-sunken' : ''
                  }`}
                >
                  <span className="w-3 text-center text-xs text-ink-subtle">
                    {sug.kind === 'tag' ? '#' : '@'}
                  </span>
                  <span>{sug.name}</span>
                  {sug.isNew && (
                    <span className="ml-auto text-xs text-ink-subtle">
                      {t(locale, 'ac_new_tag')} · ↵
                    </span>
                  )}
                  {sug.kind !== 'tag' && (
                    <span className="ml-auto text-xs text-ink-subtle">
                      {t(locale, sug.kind === 'person' ? 'ac_kind_person' : 'ac_kind_org')}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

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

        {/* What comes next, as its own section of the same form: a rule and a
            heading rather than a colour of its own (the tint was a second
            style). "Follow up: [Call] [tomorrow]" — Sjoerd, 2026-09-14. The date
            field appears only for "on a date…"; "nothing planned" is the
            default. The follow-up's kind becomes the title of its task. */}
        <div className="mt-5 border-t border-line pt-4">
          <div className={`grid gap-4 ${followUp === 'exact' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <SelectField
              label={t(locale, 'note_followup')}
              value={followUpKind}
              onChange={(e) => setFollowUpKind(e.target.value as FollowUpKind)}
              options={FOLLOW_UP_KINDS.map((k) => ({ value: k, label: t(locale, FOLLOW_UP_KIND_KEYS[k]) }))}
            />
            <SelectField
              label={t(locale, 'note_followup_when')}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value as FollowUp)}
              options={[
                ...FOLLOW_UPS.map((f) => ({ value: f, label: t(locale, FOLLOW_UP_KEYS[f]) })),
                { value: 'exact', label: t(locale, 'note_followup_exact') },
              ]}
            />
            {followUp === 'exact' && (
              <DateTimeField label={t(locale, 'note_followup_date')} value={followUpExact} onChange={setFollowUpExact} />
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <div className="mr-auto flex items-center gap-3">
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

          {/* SAVE, in the save colour. Sjoerd, 2026-09-14: Done "should also be
              something else... maybe add... why not save then?", and saving is
              yellow in every app. The draft is already kept while typing ("Draft
              saved"); this makes it final — into Conversations, with its
              follow-up task and tags. Outlined until there is something to
              keep. Both are the shared Button's own variants. */}
          <Button
            type="button"
            variant={hasContent ? 'save' : 'secondary'}
            onClick={() => void commit()}
            disabled={!hasContent}
            leading={<Check size={15} strokeWidth={2.25} />}
          >
            {t(locale, 'save')}
          </Button>
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
              vocabulary={vocabulary}
              mentionable={mentionable}
              onChanged={() => (onCommitted ? onCommitted() : router.refresh())}
            />
          ))}
        </Timeline>
      )}
    </div>
  );
}
