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
import { addAgendaPerson } from './agenda-actions';

export function AddAttendee({
  email,
  name,
  locale,
}: {
  email: string;
  /** What Google calls them. Shown, but never sent — the server looks the
   *  name up again from the meeting, so a forged body cannot write a name. */
  name: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

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

  return (
    <button
      type="button"
      disabled={pending}
      title={failed ?? email}
      aria-label={t(locale, 'agenda_add_person', { name: name || email })}
      onClick={() =>
        start(async () => {
          setFailed(null);
          const r = await addAgendaPerson(email);
          if (r.ok) {
            setAdded(r.personId);
            // The server has them now; the rest of the page (and the people
            // list behind it) is stale about that.
            router.refresh();
            return;
          }
          setFailed(t(locale, r.reason === 'gone' ? 'agenda_add_gone' : 'agenda_add_failed'));
        })
      }
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
