'use client';

// A person, in a popup, from anywhere.
//
// Sjoerd, 2026-09-12: *"Also, work with popups... like the threads.. works
// quicker and more smooth."*
//
// The pattern is Thread's (apps/thread/app/(app)/contacts/contacts-list.tsx):
// click a row, a Dialog opens over the page you are on, close it and you are
// exactly where you were. For Connections this matters more than it does in
// Thread, because the reason to open a person is almost always to write one
// line after a conversation — and landing on a different page to do it, then
// finding your way back to Today, is the friction that stops people writing.
//
// ── A link that is still a link ─────────────────────────────────────────────
//
// `PersonLink` renders a real `<a href="/people/:id">`. A plain click opens
// the popup; a cmd/ctrl-click, shift-click or middle-click falls through to
// the browser and opens the full page, exactly as any link would. So the fast
// path is the default and nothing that people expect from a link is taken
// away — sharing, opening in a new tab, the page still existing at its URL.
//
// ── One popup, many openers ─────────────────────────────────────────────────
//
// A provider at the layout holds the single dialog; every surface calls
// `openPerson(id)`. The alternative — a dialog per list — would mean several
// copies of the composer mounted at once and several places to keep the
// commit behaviour right.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { t, type Locale } from '@/lib/i18n-ui';
import { Notes, type Note } from '@/app/(app)/people/[id]/notes';
import { loadPerson, type PersonCard } from '@/app/(app)/people/[id]/load';

type Ctx = { openPerson: (id: string) => void };

const PersonPopupContext = createContext<Ctx | null>(null);

export function usePersonPopup(): Ctx {
  const ctx = useContext(PersonPopupContext);
  // Outside the provider there is no popup to open, so fall back to real
  // navigation rather than throwing: a component rendered somewhere unexpected
  // should degrade to a link, not break the page.
  return ctx ?? { openPerson: (id) => window.location.assign(`/people/${id}`) };
}

function displayName(p: PersonCard): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || p.id.slice(0, 8);
}

export function PersonPopupProvider({
  children,
  locale,
  fibreContactsBase,
}: {
  children: React.ReactNode;
  locale: Locale;
  /** Resolved on the server: a client component cannot read the env map. */
  fibreContactsBase: string;
}) {
  const [id, setId] = useState<string | null>(null);
  const [person, setPerson] = useState<PersonCard | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (personId: string) => {
    setLoading(true);
    setError(null);
    // Caught HERE as well as inside loadPerson, and the second catch is not
    // redundant. loadPerson never throws from its own code, but the call to it
    // is a network request to a server action, and that request can fail — a
    // dropped connection, a deploy mid-request. A rejection there skips every
    // line after the await, so without this the popup would sit on "Loading"
    // with no error and no way out. The first version guarded only the server
    // side and was therefore half a fix; a test that makes the call itself
    // reject is what showed it.
    let r: Awaited<ReturnType<typeof loadPerson>>;
    try {
      r = await loadPerson(personId);
    } catch (e) {
      r = { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
    }
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPerson(r.person);
    setNotes(r.notes);
  }, []);

  // ── Back closes the popup ─────────────────────────────────────────────────
  //
  // On a phone "back" is how people close things, so opening pushes a history
  // entry and popping it closes the popup instead of leaving the page.
  //
  // The push happens in the click handler and there is ONE path that clears
  // state — the popstate listener. Closing from the X or Escape goes back
  // through history, which fires popstate, which clears. `pushed` is a ref so
  // the listener, registered once, always sees the truth.
  //
  // A CORRECTION, kept here because the wrong version was written here first.
  // An earlier draft of this comment claimed the original design — push in an
  // effect, back() in its cleanup — closed the popup the instant it opened,
  // because "React runs effects twice in development". That was false, and
  // was stated as a caught bug without being checked. StrictMode double-runs
  // an effect only when a component MOUNTS; the provider mounts with no
  // person open, where the effect returns early, and opening a person is an
  // update that runs the effect once. Measured, not reasoned: on mount the log
  // reads `run cleanup run`, on opening a person `cleanup run`. The regression
  // test written for the imaginary bug passed against both versions, which is
  // how it was found.
  //
  // The rewrite stays for the reasons that are true: one exit path instead of
  // two to keep in step, and no stacked history entry if a second person is
  // opened while one is showing.
  const pushed = useRef(false);

  const clear = useCallback(() => {
    setId(null);
    setPerson(null);
    setNotes([]);
    setError(null);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      clear();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [clear]);

  const openPerson = useCallback(
    (personId: string) => {
      // Only one entry per open popup. Opening a second person while one is
      // showing is not reachable through the interface (the backdrop covers
      // every link), but guarding it costs nothing and a stacked entry would
      // make back take two presses.
      if (!pushed.current) {
        window.history.pushState({ personPopup: true }, '');
        pushed.current = true;
      }
      setId(personId);
      // Clear the previous person immediately. Showing Wilma's notes for the
      // half second it takes to load Joost is the kind of flash that makes
      // somebody type into the wrong person's composer.
      setPerson(null);
      setNotes([]);
      void load(personId);
    },
    [load],
  );

  /** X, Escape, backdrop: go back through history so there is one exit. */
  const close = useCallback(() => {
    if (pushed.current) window.history.back();
    else clear();
  }, [clear]);

  const name = person ? displayName(person) : '';

  return (
    <PersonPopupContext.Provider value={{ openPerson }}>
      {children}

      {/* The title only says "Loading" while it IS loading. It used to fall
          back to that whenever no person was set, so a failed load showed
          "Loading…" above "Could not load this person" — two statements that
          cannot both be true. Found by a test asserting the popup does not
          hang, which failed on the title once the hang itself was fixed. */}
      {id && (
        <Dialog
          open
          onClose={close}
          title={name || (error ? t(locale, 'nav_people') : t(locale, 'loading'))}
          size="lg"
        >
          {error && <p className="text-sm text-ink">{t(locale, 'person_load_failed')} {error}</p>}

          {loading && !person && <p className="text-sm text-ink-muted">{t(locale, 'loading')}</p>}

          {person && (
            <div>
              {person.email && <p className="text-sm text-ink-muted">{person.email}</p>}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {/* Clears the popup BEFORE navigating. The provider lives in
                    the layout, which does not remount on a route change, so
                    without this the dialog would stay open on top of the very
                    page it just linked to. The history entry it pushed is left
                    in place deliberately: it points at the page underneath, so
                    back from the full page lands on the list — which is where
                    the person came from. */}
                <Link
                  href={`/people/${person.id}`}
                  onClick={() => {
                    pushed.current = false;
                    clear();
                  }}
                  className="text-ink-muted underline underline-offset-2 hover:text-ink"
                >
                  {t(locale, 'person_open_full')}
                </Link>
                {/* A NEW TAB. Sjoerd, 2026-09-13: "moving to the fibre (more
                    contact info) is confusing... you're totally left
                    connections then". It carried the external-link icon while
                    navigating in place, so following it dropped you out of
                    Connections — out of the map you were walking through, and
                    out of the popup you opened from it — with only Back to
                    return. The icon was already telling the truth; the link
                    now behaves like it. */}
                <a
                  href={`${fibreContactsBase}/${person.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                >
                  {t(locale, 'person_open_in_fibre')}
                  <ExternalLink size={11} strokeWidth={1.75} />
                </a>
              </div>

              {/* The same composer the page uses, reloading the list INSIDE
                  the dialog on commit rather than refreshing the page under
                  it — see Notes' onCommitted. Keyed by person so switching
                  people never carries a half-typed draft across. */}
              <Notes
                key={person.id}
                personId={person.id}
                personName={name}
                notes={notes}
                locale={locale}
                onCommitted={() => void load(person.id)}
              />
            </div>
          )}
        </Dialog>
      )}
    </PersonPopupContext.Provider>
  );
}

/**
 * A link to a person that opens the popup on a plain click.
 *
 * Modifier and middle clicks are left to the browser, so "open in a new tab"
 * still opens the full page — the popup is the fast path, never the only one.
 */
export function PersonLink({
  personId,
  className,
  children,
  title,
}: {
  personId: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const { openPerson } = usePersonPopup();
  return (
    <a
      href={`/people/${personId}`}
      title={title}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openPerson(personId);
      }}
    >
      {children}
    </a>
  );
}
