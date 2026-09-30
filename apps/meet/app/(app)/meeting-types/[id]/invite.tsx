'use client';

// Asking people to a meeting poll.
//
// Sjoerd, 2026-09-30: add invitees with "het single point of truth search
// field dat we in connections elke keer gebruiken — zoeken of toevoegen",
// then a message and an email that goes out on its own.
//
// So it is the shared PersonCombobox, not a new picker: the same field, the
// same search-then-offer-to-create behaviour, the same server-side search
// under this app's own RLS. Somebody who is not a contact yet is typed in as
// a name and an address and invited anyway — a poll is exactly the moment you
// reach outside your own list.

import { useState, useTransition } from 'react';
import { X, Send } from 'lucide-react';
import { PersonCombobox, type PersonOption } from '@thefibre/shared/ui/person-combobox';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { t, type Locale } from '@/lib/i18n-ui';
import { searchPeople, sendPollInvites } from '../actions';

type Invitee = { person_id?: string; email: string; name: string };

export function PollInvites({
  mtId,
  alreadyInvited,
  locale,
}: {
  mtId: string;
  /** Emails already asked — they are offered again as a re-send, not hidden,
   *  but the host can see at a glance who is on the list. */
  alreadyInvited: { email: string; name: string }[];
  locale: Locale;
}) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<Invitee[]>([]);
  const [message, setMessage] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  function addManual() {
    const email = manualEmail.trim().toLowerCase();
    const name = manualName.trim() || email;
    if (!email) return;
    if (chosen.some((c) => c.email === email)) return;
    setChosen([...chosen, { email, name }]);
    setManualName('');
    setManualEmail('');
  }

  function send() {
    setErr(null);
    setSentCount(null);
    if (chosen.length === 0) {
      setErr(t(locale, 'invite_pick_someone'));
      return;
    }
    start(async () => {
      const r = await sendPollInvites(mtId, chosen, message.trim() || undefined);
      if (r.error) setErr(r.error);
      else {
        setSentCount(r.sent ?? chosen.length);
        setChosen([]);
        setMessage('');
      }
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5 space-y-4">
      <PersonCombobox
        label={t(locale, 'invite_people')}
        search={searchPeople}
        exclude={chosen.map((c) => c.person_id ?? '').filter(Boolean)}
        placeholder={t(locale, 'invite_search_placeholder')}
        onChange={(id, label) => {
          // The combobox hands back the label it was already showing, so the
          // chip has a name without a second request.
          if (!id || chosen.some((c) => c.person_id === id)) return;
          setChosen([...chosen, { person_id: id, email: '', name: label ?? id }]);
        }}
      />

      {/* Somebody who is not a contact yet. A poll is exactly when you reach
          outside your own list, so this is a first-class path, not a fallback. */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <TextField
          label={t(locale, 'name')}
          name="invite_name"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
        />
        <TextField
          label={t(locale, 'email')}
          name="invite_email"
          type="email"
          value={manualEmail}
          onChange={(e) => setManualEmail(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={addManual} disabled={!manualEmail.trim()}>
          {t(locale, 'add')}
        </Button>
      </div>

      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chosen.map((c) => (
            <li
              key={c.person_id ?? c.email}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm"
            >
              <span>{c.name}</span>
              <button
                type="button"
                onClick={() => setChosen(chosen.filter((x) => x !== c))}
                className="text-ink-muted hover:text-ink"
                aria-label={t(locale, 'remove')}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="invite-message" className="block text-sm font-medium mb-1.5">
          {t(locale, 'invite_message')}
        </label>
        <textarea
          id="invite-message"
          rows={3}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t(locale, 'invite_message_placeholder')}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-muted">
          {alreadyInvited.length > 0 &&
            t(locale, 'already_invited_n', { n: String(alreadyInvited.length) })}
        </div>
        <Button
          type="button"
          onClick={send}
          disabled={pending || chosen.length === 0}
          leading={<Send className="h-4 w-4" strokeWidth={1.5} />}
          className="shrink-0 whitespace-nowrap"
        >
          {pending ? t(locale, 'saving') : t(locale, 'send_invitations')}
        </Button>
      </div>

      {err && <p className="text-sm text-red-700">{err}</p>}
      {sentCount !== null && (
        <p className="text-sm text-emerald-700">
          {t(locale, 'invitations_sent', { n: String(sentCount) })}
        </p>
      )}
    </div>
  );
}
