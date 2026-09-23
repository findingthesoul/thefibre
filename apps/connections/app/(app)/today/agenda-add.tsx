'use client';

// The attendee who is not yet anybody, and the one press that makes them one.
//
// Sjoerd, 2026-09-21: *"there I see people who are not yet in my contact
// list... Would be great if I could just click on their name and add people
// from this agenda."*
//
// The chip was already the most useful thing on Today — somebody you are
// about to meet whom the app does not know — and it was inert. Now it is a
// button, and after the press it becomes the ordinary person chip, so the
// next tap opens them and writes the note. Nothing is created by the sync:
// this is one person, pressed on purpose, which is the rule the agenda route
// is built around.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { PersonLink } from '@/components/person-popup';
import { t, type Locale } from '@/lib/i18n-ui';
import { addAgendaPerson, attachAddress } from './agenda-actions';

export function AddAttendee({
  email,
  name,
  locale,
  sameName = [],
}: {
  email: string;
  /** What Google calls them. Shown, but never sent — the server looks the
   *  name up again from the meeting, so a forged body cannot write a name. */
  name: string | null;
  locale: Locale;
  /**
   * People already on file with this exact name, from the route.
   *
   * Sjoerd, 2026-09-23: *"in fibre this person exist... but the TODAY meeting
   * does not recognize it"*, and then the cause in his own words — *"I added
   * him before through this interface - I assumed it connected email."* It
   * did not: a person created from a name alone has no address, and the
   * agenda can only match on one, so they stay a stranger for ever.
   *
   * Pressing add would have made a SECOND copy of them. So when there is a
   * name match the chip asks instead, and the answer is a person's, not a
   * guess of ours.
   */
  sameName?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Showing "is this them?" rather than having created anything. */
  const [asking, setAsking] = useState(false);

  // Added: the same chip everybody else on this row has, so the eye does not
  // have to learn a third state. It opens the popup, which is where the note
  // gets written — the whole point of adding them.
  if (added) {
    return (
      <PersonLink
        personId={added}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs transition-colors hover:border-ink/40"
      >
        <span className="font-medium">{name || email}</span>
        <span className="text-ink-subtle">· {t(locale, 'agenda_never_written')}</span>
      </PersonLink>
    );
  }

  // The question, when somebody of that name is already on file. Inline
  // rather than a dialog: this chip lives inside one, and a dialog inside a
  // dialog is how the write-up ended up behind the agenda in v0.89.0.
  if (asking) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-xs">
        <span className="text-ink-subtle">
          {t(locale, 'agenda_same_name', { name: sameName[0]!.name })}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await attachAddress(sameName[0]!.id, email);
              if (r.ok) {
                setAdded(sameName[0]!.id);
                setAsking(false);
                router.refresh();
                return;
              }
              setFailed(t(locale, 'agenda_add_failed'));
            })
          }
          className="rounded-full bg-ink px-2.5 py-1 font-medium text-ink-inverse disabled:opacity-60"
        >
          {t(locale, 'agenda_same_yes')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setAsking(false);
            start(async () => {
              const r = await addAgendaPerson(email);
              if (r.ok) {
                setAdded(r.personId);
                router.refresh();
                return;
              }
              setFailed(t(locale, r.reason === 'gone' ? 'agenda_add_gone' : 'agenda_add_failed'));
            });
          }}
          className="rounded-full border border-line px-2.5 py-1 text-ink-subtle hover:text-ink disabled:opacity-60"
        >
          {t(locale, 'agenda_same_no')}
        </button>
        {failed && <span className="text-ink">{failed}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      title={failed ?? email}
      aria-label={t(locale, 'agenda_add_person', { name: name || email })}
      onClick={() => {
        setFailed(null);
        // Somebody of this name is already here — ask before making a second.
        if (sameName.length > 0) {
          setAsking(true);
          return;
        }
        start(async () => {
          const r = await addAgendaPerson(email);
          if (r.ok) {
            setAdded(r.personId);
            // The server has them now; the rest of the page (and the people
            // list behind it) is stale about that.
            router.refresh();
            return;
          }
          setFailed(t(locale, r.reason === 'gone' ? 'agenda_add_gone' : 'agenda_add_failed'));
        });
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dotted border-line-strong px-3 text-xs text-ink-subtle transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
      <span className="max-w-[14rem] truncate">{name || email}</span>
      {/* The chip says what pressing it does. "Not yours" only named the
          state; this names the action, which is what he asked for. */}
      <span>· {failed ?? t(locale, 'agenda_add')}</span>
    </button>
  );
}
