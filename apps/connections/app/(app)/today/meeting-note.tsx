'use client';

// Write up a meeting from the agenda, for everyone who was in it.
//
// Sjoerd, 2026-09-21: *"When click on the meeting, it should open and select
// the people present and potentially add info immediately (like: online
// meeting, date filled in, and fill in basic content in the description field
// ... like the title of the meeting)."*
//
// The composer on a person's page starts from a blank box because nothing is
// known. Here everything IS known — who was there, when it was, what it was
// called — so the dialog opens already filled in and the only thing left to
// do is the part a machine cannot do: say what was said.
//
// ── One note each, not one note about five people ──────────────────────────
//
// A note hangs off one person (flow_run_note.person_id), and that is the
// right shape: six months from now the question is "what happened with her",
// asked on her page. So this writes the same words once per person you ticked,
// each with the others named in `mentions`, which is how the app already
// records "these people were in the same room" without inventing a
// relationship out of co-occurrence (connections-data-integrity §12).
//
// Everything in the box is a suggestion. Untick somebody who did not turn up,
// change the date, rewrite the line — the calendar proposes, the person
// decides. Nothing is written until Save.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search, Video } from 'lucide-react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { FIELD_CLASS, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, SelectField } from '@thefibre/shared/ui/fields';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { saveNote, loadMyTeams, fetchVocabulary, type NoteKind, type MyTeam } from '../people/[id]/actions';
// The same row and the same stamp the person-page composer uses, from the
// same module, so the two boxes stay one design (Sjoerd, 2026-09-14: "one
// single point of truth").
import { FIELD_ROW, localStamp } from '@/lib/note-fields';
import { joinLink, placeLink } from '@/lib/meeting-links';
import { AddAttendee } from './agenda-add';
import type { AgendaEvent } from './agenda';

const KIND_KEYS = {
  note: 'note_kind_note',
  call: 'note_kind_call',
  meeting: 'note_kind_meeting',
  encounter: 'note_kind_encounter',
  message: 'note_kind_message',
  email: 'note_kind_email',
} as const;
const KINDS: NoteKind[] = ['note', 'call', 'meeting', 'encounter', 'message', 'email'];

// CONTROLLED, and the dialog is rendered by the LIST rather than by a row.
//
// It used to render its own trigger and hold its own `open`, which put the
// dialog inside the row's <li>. That was fine until past rows were dimmed on
// 2026-09-21: `opacity` below 1 creates a containing block for `position:
// fixed` descendants AND applies to them, so the dialog stopped being
// full-screen and came up translucent, laid over the list. (Screenshot from
// Sjoerd the same evening.) The shared Dialog is `fixed inset-0` with no
// portal, so ANY ancestor with opacity, a transform or a filter does this —
// which is why the answer is to keep the dialog out of such a subtree rather
// than to pick a different way of dimming.
//
// One dialog for the whole list is also simply less: a day with eight
// meetings held eight prepared dialogs.
export function MeetingWriteUp({
  event,
  locale,
  onClose,
}: {
  /** The meeting being written up, or null when the dialog is closed. */
  event: AgendaEvent | null;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const open = event !== null;
  const setOpen = (v: boolean) => {
    if (!v) onClose();
  };

  const known = event ? event.people.filter((p) => p.person_id) : [];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** People added by hand, who were in the room but not on the invitation —
   *  which is most of them, for anything that is not a video call. */
  const [extra, setExtra] = useState<{ id: string; name: string }[]>([]);
  const [kind, setKind] = useState<NoteKind>('meeting');
  const [body, setBody] = useState('');
  const [happenedOn, setHappenedOn] = useState('');
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  /** Remounts the uncontrolled DateField when another meeting is opened.
   *  Without it the field keeps whatever it mounted with — which, since the
   *  dialog became always-mounted (v0.91.0), is empty. Sjoerd, 2026-09-22:
   *  "Date should be filled for today". */
  const [whenKey, setWhenKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Minted per attempt, not per render: a retry after a failure must reuse
  // the same keys or the first half of the room gets a second note.
  const refs = useRef<Map<string, string>>(new Map());

  // Filled on OPENING, not on mounting: a day with six meetings would
  // otherwise hold six prepared forms, and re-opening one after cancelling
  // should start from the calendar again rather than from what was abandoned.
  useEffect(() => {
    if (!event) return;
    setPicked(new Set(known.map((p) => p.person_id!)));
    setExtra([]);
    setKind('meeting');
    setBody(event.summary ? `${event.summary}\n\n` : '');
    setHappenedOn(localStamp(new Date(event.start)).slice(0, 10));
    setWhenKey((k) => k + 1);
    setError(null);
    refs.current = new Map();
    loadMyTeams().then((ts) => {
      setTeams(ts);
      // The default if there is one; otherwise the only team there is.
      // Sjoerd, 2026-09-22: "Team: again, which team is expected?" — "no
      // team" is a real answer, but not one to hand somebody who belongs to
      // exactly one team and has never been asked.
      setTeamId(ts.find((tm) => tm.is_default)?.id ?? (ts.length === 1 ? ts[0]!.id : null));
    });
    // `known` is derived from `event` on every render; depending on it would
    // re-run this on each keystroke and wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  /** Everyone offerable as present: the invitation's known people, then the
   *  ones named by hand. One entry per person. */
  const roster = [
    ...known.map((p) => ({ id: p.person_id!, name: p.person_name || p.email })),
    ...extra.filter((e) => !known.some((p) => p.person_id === e.id)),
  ];

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    const ids = [...picked];
    if (ids.length === 0 || !event) return;
    setSaving(true);
    setError(null);

    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
      tz = undefined;
    }

    // The meeting's real start when the date is still the meeting's own,
    // noon when somebody moved it — the person composer's rule, for the same
    // reason: a date without a time should not claim midnight.
    const onMeetingDay = happenedOn === localStamp(new Date(event.start)).slice(0, 10);
    const happenedAt = onMeetingDay
      ? new Date(event.start).toISOString()
      : new Date(`${happenedOn}T12:00`).toISOString();

    // One at a time, not Promise.all: each write applies tags and mentions
    // server-side, and a burst of them against the same people is how you
    // discover a race you did not need to take.
    const failed: string[] = [];
    for (const id of ids) {
      if (!refs.current.has(id)) refs.current.set(id, crypto.randomUUID());
      const r = await safely(
        () =>
          saveNote({
            client_ref: refs.current.get(id)!,
            person_id: id,
            team_id: teamId,
            body,
            kind,
            happened_at: happenedAt,
            ...(tz ? { happened_tz: tz } : {}),
            is_draft: false,
            // Everybody else who was in the room. Not a relationship claim —
            // a record that they were both there, which is what mentions are.
            mentions: ids.filter((other) => other !== id),
          }),
        (e) => ({ ok: false as const, error: e }),
      );
      if (!r.ok) failed.push(id);
    }

    setSaving(false);
    if (failed.length > 0) {
      // The ones that worked keep their client_ref, so pressing Save again
      // rewrites them rather than duplicating them.
      setError(t(locale, 'meeting_note_partly_failed', { count: failed.length }));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={event?.summary || t(locale, 'agenda_untitled')}
        description={t(locale, 'meeting_note_intro')}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t(locale, 'cancel')}
            </Button>
            <Button
              type="button"
              variant="save"
              onClick={save}
              disabled={saving || picked.size === 0}
            >
              {saving ? t(locale, 'saving') : t(locale, 'save')}
            </Button>
          </div>
        }
      >
        {/* The way in and the place, as real links — a grid block is a
            button and cannot contain one, so this is where they live now
            (2026-09-22). */}
        <MeetingLinks event={event} locale={locale} />

        <div className={FIELD_ROW}>
          <SelectField
            label={t(locale, 'encounter_field')}
            value={kind}
            onChange={(e) => setKind(e.target.value as NoteKind)}
            options={KINDS.map((k) => ({ value: k, label: t(locale, KIND_KEYS[k]) }))}
          />
          <DateField
            key={whenKey}
            label={t(locale, 'note_when')}
            name="happened_on"
            defaultValue={happenedOn}
            onValueChange={setHappenedOn}
            compact
          />
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
            />
          )}
        </div>

        <label className="mt-4 block">
          <span className={FIELD_LABEL_CLASS}>{t(locale, 'meeting_note_body')}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            autoFocus
            placeholder={t(locale, 'meeting_note_body_ph')}
            className={`mt-1 ${FIELD_CLASS} leading-relaxed`}
          />
        </label>
        {/* Named, because the difference between this box and the one on a
            person's page is the thing that could surprise somebody. */}
        <p className="mt-1.5 text-xs text-ink-subtle">
          {t(locale, 'meeting_note_each', { count: picked.size })}
        </p>

        <fieldset className="mt-4">
          <legend className={FIELD_LABEL_CLASS}>{t(locale, 'meeting_note_who')}</legend>
          {roster.length === 0 && (
            <p className="mt-1 text-sm text-ink-muted">{t(locale, 'meeting_note_nobody')}</p>
          )}
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {roster.map((p) => {
              const on = picked.has(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
                      on ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-subtle'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p.id)}
                      className="sr-only"
                    />
                    {p.name}
                  </label>
                </li>
              );
            })}
          </ul>
          {/* The ones the app does not know are NOT offered here. Adding
              somebody is its own decision and it has its own button on the
              row behind this dialog — burying it inside a save would create
              people as a side effect of writing a sentence. */}
          {/* Anybody else who was in the room. A meeting in a building has
              nobody on its invitation, and until now this box could only
              offer what Google knew — Sjoerd, 2026-09-22: "Nobody was there...
              an add button, so I can list people who were present." */}
          <AddPresent
            locale={locale}
            exclude={roster.map((p) => p.id)}
            onAdd={(person) => {
              setExtra((cur) => (cur.some((e) => e.id === person.id) ? cur : [...cur, person]));
              setPicked((cur) => new Set(cur).add(person.id));
            }}
          />

          {/* The people in the room who are not on file. Offered HERE as
              well as on the page, because the grid's blocks have no room for
              them and burying them would lose the most useful thing this
              page knows. Still a press each: adding somebody stays a
              decision, never a side effect of saving a sentence. */}
          {event && event.people.some((p) => !p.person_id) && (
            <>
              <p className="mt-3 text-xs text-ink-muted">{t(locale, 'meeting_note_unknown')}</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {event.people
                  .filter((p) => !p.person_id)
                  .map((p) => (
                    <li key={p.email}>
                      <AddAttendee email={p.email} name={p.calendar_name} locale={locale} />
                    </li>
                  ))}
              </ul>
            </>
          )}
        </fieldset>

        {error && <p className="mt-3 text-sm text-ink">{error}</p>}
    </Dialog>
  );
}

/** The meeting's way in and its place, as links. */
function MeetingLinks({ event, locale }: { event: AgendaEvent | null; locale: Locale }) {
  if (!event) return null;
  const join = joinLink(event.location, event.conference_url);
  const place = placeLink(event.location);
  if (!join && !place) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {join && (
        <a
          href={join.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-line px-2.5 text-xs text-ink-subtle transition-colors hover:border-ink hover:text-ink"
        >
          <Video size={12} className="shrink-0" />
          {t(locale, JOIN_KEYS[join.kind])}
        </a>
      )}
      {place && (
        <a
          href={place.url}
          target="_blank"
          rel="noopener noreferrer"
          title={place.label}
          className="inline-flex h-7 min-w-0 items-center gap-1 rounded-full border border-line px-2.5 text-xs text-ink-subtle transition-colors hover:border-ink hover:text-ink"
        >
          <MapPin size={12} className="shrink-0" />
          <span className="max-w-[12rem] truncate">{place.label}</span>
        </a>
      )}
    </div>
  );
}

const JOIN_KEYS = {
  meet: 'agenda_join_meet',
  zoom: 'agenda_join_zoom',
  teams: 'agenda_join_teams',
  video: 'agenda_join',
} as const;

/**
 * Name somebody who was there.
 *
 * The same list the `@` picker reads, so there is one answer to "who does this
 * workspace know". An id, never a typed name — attaching by identifier is the
 * rule (handbook §12), and here it matters twice over: a note filed against a
 * guess at a name is a claim about the wrong person.
 *
 * The results sit in the flow rather than floating, for the reason the
 * relationship card's picker records: this is inside a dialog, and a floating
 * list opens into the dialog's bottom edge.
 */
function AddPresent({
  locale,
  exclude,
  onAdd,
}: {
  locale: Locale;
  exclude: string[];
  onAdd: (p: { id: string; name: string }) => void;
}) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [term, setTerm] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchVocabulary().then((v) => {
      if (alive) setPeople(v.people);
    });
    return () => {
      alive = false;
    };
  }, []);

  const q = term.trim().toLowerCase();
  const skip = new Set(exclude);
  const matches = q
    ? people.filter((p) => !skip.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 6)
    : [];

  return (
    <div className="mt-3">
      <div className="relative">
        <Search
          size={15}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t(locale, 'meeting_note_add_present')}
          aria-label={t(locale, 'meeting_note_add_present')}
          className={`${FIELD_INPUT_CLASS} pl-9`}
        />
      </div>
      {q && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-line bg-surface py-1">
          {matches.length === 0 ? (
            <li className="px-3 py-1.5 text-sm text-ink-muted">{t(locale, 'people_none')}</li>
          ) : (
            matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onAdd(p);
                    setTerm('');
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-sunken"
                >
                  {p.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
