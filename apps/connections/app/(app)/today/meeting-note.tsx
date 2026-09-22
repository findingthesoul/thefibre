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
import { Dialog } from '@thefibre/shared/ui/dialog';
import { FIELD_CLASS, FIELD_LABEL_CLASS, SelectField } from '@thefibre/shared/ui/fields';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { saveNote, loadMyTeams, type NoteKind, type MyTeam } from '../people/[id]/actions';
// The same row and the same stamp the person-page composer uses, from the
// same module, so the two boxes stay one design (Sjoerd, 2026-09-14: "one
// single point of truth").
import { FIELD_ROW, localStamp } from '@/lib/note-fields';
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
  const [kind, setKind] = useState<NoteKind>('meeting');
  const [body, setBody] = useState('');
  const [happenedOn, setHappenedOn] = useState('');
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
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
    setKind('meeting');
    setBody(event.summary ? `${event.summary}\n\n` : '');
    setHappenedOn(localStamp(new Date(event.start)).slice(0, 10));
    setError(null);
    refs.current = new Map();
    loadMyTeams().then((ts) => {
      setTeams(ts);
      setTeamId(ts.find((tm) => tm.is_default)?.id ?? null);
    });
    // `known` is derived from `event` on every render; depending on it would
    // re-run this on each keystroke and wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

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
        <div className={FIELD_ROW}>
          <SelectField
            label={t(locale, 'encounter_field')}
            value={kind}
            onChange={(e) => setKind(e.target.value as NoteKind)}
            options={KINDS.map((k) => ({ value: k, label: t(locale, KIND_KEYS[k]) }))}
          />
          <DateField
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
          {known.length === 0 && (
            <p className="mt-1 text-sm text-ink-muted">{t(locale, 'meeting_note_nobody')}</p>
          )}
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {known.map((p) => {
              const on = picked.has(p.person_id!);
              return (
                <li key={p.email}>
                  <label
                    className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
                      on ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-subtle'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p.person_id!)}
                      className="sr-only"
                    />
                    {p.person_name}
                  </label>
                </li>
              );
            })}
          </ul>
          {/* The ones the app does not know are NOT offered here. Adding
              somebody is its own decision and it has its own button on the
              row behind this dialog — burying it inside a save would create
              people as a side effect of writing a sentence. */}
          {event?.people.some((p) => !p.person_id) && (
            <p className="mt-2 text-xs text-ink-muted">{t(locale, 'meeting_note_unknown')}</p>
          )}
        </fieldset>

        {error && <p className="mt-3 text-sm text-ink">{error}</p>}
    </Dialog>
  );
}
