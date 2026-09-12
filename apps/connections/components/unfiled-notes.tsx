'use client';

// Notes written offline that still need a person.
//
// The offline page no longer carries a list of people (2026-09-13), so a note
// written there holds only the name somebody typed. Back online, this asks
// who it is about and offers the people whose names match. It never picks for
// you: system-handbook §12 — a person is attached by an exact identifier,
// never by a name in prose — and two Wilmas is an ordinary community.
//
// The candidates are read live from the server when this renders and are
// never stored.

import { useCallback, useEffect, useRef, useState } from 'react';
import { t, type Locale } from '@/lib/i18n-ui';
import { foldKey } from '@/lib/detect-tags';
import { fetchVocabulary } from '@/app/(app)/people/[id]/actions';
import {
  QUEUE_CHANGED,
  fileNote,
  unfiledNotes,
  type UnfiledNote,
} from '@/lib/offline-notes';

type Person = { id: string; name: string };

/**
 * People whose name matches what was typed: every typed word must start a
 * word of the name, so "wil doorn" finds Wilma Doornbos and "ma" does not
 * find every Emma. Exported for the test; the component shows at most five.
 */
export function candidatesFor(typed: string, people: Person[]): Person[] {
  // Accents are stripped HERE, not in foldKey: a name typed on a phone in a
  // hurry is "jose", while foldKey also keys highlight ranges in the note
  // composer and must keep the text's own letters.
  const bare = (s: string) => foldKey(s.normalize('NFD').replace(/\p{M}/gu, ''));
  const words = bare(typed).split(' ').filter(Boolean);
  if (!words.length) return [];
  return people.filter((p) => {
    const nameWords = bare(p.name).split(' ');
    return words.every((w) => nameWords.some((n) => n.startsWith(w)));
  });
}

export function UnfiledNotes({ workspaceId, locale }: { workspaceId: string | null; locale: Locale }) {
  const [notes, setNotes] = useState<UnfiledNote[]>([]);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});

  const read = useCallback(() => setNotes(workspaceId ? unfiledNotes(workspaceId) : []), [workspaceId]);

  useEffect(() => {
    read();
    window.addEventListener(QUEUE_CHANGED, read);
    return () => window.removeEventListener(QUEUE_CHANGED, read);
  }, [read]);

  // Only asked for when there is something to file. An EMPTY answer is kept
  // as "could not load" rather than as "nobody matches": fetchVocabulary
  // returns an empty list on failure, and a workspace with notes in it has
  // people. Asked again when the connection returns.
  //
  // `people` is deliberately NOT a dependency: an empty answer is a new array,
  // which would re-run this and fetch again in a loop. The ref answers "do we
  // already have people" without re-subscribing.
  const havePeople = useRef(false);
  const waiting = notes.length > 0;
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const load = () => {
      if (havePeople.current) return;
      fetchVocabulary()
        .then((v) => {
          if (!alive) return;
          havePeople.current = v.people.length > 0;
          setPeople(v.people);
        })
        // Offline, the server action itself rejects. Leave it on loading.
        .catch(() => {});
    };
    load();
    window.addEventListener('online', load);
    return () => {
      alive = false;
      window.removeEventListener('online', load);
    };
  }, [waiting]);

  if (!notes.length) return null;

  function choose(note: UnfiledNote, personId: string) {
    if (fileNote(note.client_ref, personId)) {
      // OfflineSync listens for this and sends the note now it has a person.
      window.dispatchEvent(new Event(QUEUE_CHANGED));
    }
  }

  return (
    <section
      aria-label={t(locale, 'unfiled_title')}
      className="mx-auto mb-6 max-w-2xl rounded-lg border border-line bg-surface-raised p-4 text-sm"
    >
      <h2 className="font-medium">{t(locale, 'unfiled_title')}</h2>
      <p className="mt-1 text-xs text-ink-muted">{t(locale, 'unfiled_intro')}</p>

      <ul className="mt-3 space-y-4">
        {notes.map((note) => {
          const query = search[note.client_ref] ?? note.person_name;
          const matches = people ? candidatesFor(query, people).slice(0, 5) : [];
          return (
            <li key={note.client_ref} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="line-clamp-3 whitespace-pre-wrap text-ink">{note.body}</p>
              <label className="mt-2 block text-xs text-ink-subtle">
                {t(locale, 'unfiled_typed', { name: note.person_name || '—' })}
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setSearch((s) => ({ ...s, [note.client_ref]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
                />
              </label>
              {people === null && <p className="mt-2 text-xs text-ink-muted">{t(locale, 'loading')}</p>}
              {people !== null && people.length === 0 && (
                <p className="mt-2 text-xs text-ink-muted">{t(locale, 'unfiled_load_failed')}</p>
              )}
              {people !== null && people.length > 0 && matches.length === 0 && (
                <p className="mt-2 text-xs text-ink-muted">{t(locale, 'unfiled_no_match')}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(note, p.id)}
                    className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-surface-sunken"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
