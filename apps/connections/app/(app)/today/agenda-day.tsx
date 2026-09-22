'use client';

// The day, whole: what has already happened as well as what has not.
//
// Sjoerd, 2026-09-21: *"I like to see the whole day... greyed out what has
// passed, but still clickable... a line of the time."*
//
// Three things follow from that sentence, and the third is the one that is
// easy to miss.
//
//  1. WHOLE. The route reads from the viewer's own midnight now (whole_day),
//     not from this moment, so a meeting at nine is still on the page at four.
//  2. GREYED BUT CLICKABLE. A finished meeting is the one you most want to
//     write up — this page exists to turn a meeting into a note — so past
//     rows are quietened, never disabled. Opacity, not a colour: it dims the
//     name, the chips and the links together and cannot invent a meaning.
//  3. A LINE OF THE TIME. Where you are in the day, drawn between the rows,
//     the way a calendar draws it. It is the only thing on this page that
//     answers "what now" without being read.
//
// CLIENT, and the clock only starts after mount. The server's clock is UTC
// and the viewer's is not, so a "now" rendered on the server would put the
// line in the wrong place and React would then correct it — a visible jump.
// Before mount there is no line and nothing is dimmed, which is a correct,
// quiet first frame rather than a wrong one.

import { useEffect, useState } from 'react';
import { MapPin, Video } from 'lucide-react';
import { PersonLink } from '@/components/person-popup';
import { ROW_LIST } from '@thefibre/shared/ui/recipes';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { joinLink, placeLink, type JoinKind } from '@/lib/meeting-links';
import { BAND_KEYS } from '../landscape/axes';
import { AddAttendee } from './agenda-add';
import { MeetingWriteUp } from './meeting-note';
import type { AgendaEvent } from './agenda';

function clock(iso: string, intl: string): string {
  try {
    return new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(11, 16);
  }
}

/** "3 weeks ago" is more use here than a date: the question this answers is
 *  how long it has been, not when exactly. */
function since(iso: string | null, intl: string): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 0) return null;
  try {
    const rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
    if (days < 31) return rtf.format(-days, 'day');
    if (days < 365) return rtf.format(-Math.round(days / 30), 'month');
    return rtf.format(-Math.round(days / 365), 'year');
  } catch {
    return null;
  }
}

const JOIN_KEYS: Record<JoinKind, UiKey> = {
  meet: 'agenda_join_meet',
  zoom: 'agenda_join_zoom',
  teams: 'agenda_join_teams',
  video: 'agenda_join',
};

export function AgendaDay({
  events,
  locale,
  intl,
  labels,
}: {
  events: AgendaEvent[];
  locale: Locale;
  intl: string;
  labels?: Record<string, Record<string, string>>;
}) {
  // ONE dialog for the list, not one per row. A dialog rendered inside a row
  // would sit inside that row's `opacity` (see meeting-note.tsx) and come up
  // translucent and mispositioned — which it did, on 2026-09-21.
  const [writing, setWriting] = useState<AgendaEvent | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    // Once a minute is as often as a line between rows can usefully move.
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const bandLabel = (band: string) => {
    const own = labels?.maturity?.[band];
    if (own) return own;
    const k: UiKey | undefined = BAND_KEYS.maturity[band];
    return k ? t(locale, k) : band;
  };

  // All-day entries first and never dimmed: they have no place on a clock,
  // and "Home" is not over at eleven.
  const allDay = events.filter((e) => e.all_day);
  const timed = events.filter((e) => !e.all_day);

  // Where the line goes: before the first meeting still to come. All of them
  // past puts it at the end, which is a true and quietly useful statement.
  const lineAt =
    now === null ? -1 : (() => {
      const i = timed.findIndex((e) => new Date(e.start).getTime() > now);
      return i === -1 ? timed.length : i;
    })();

  const row = (ev: AgendaEvent) => {
    const past = now !== null && new Date(ev.end).getTime() <= now;
    return (
      <li
        key={ev.id}
        // Dimmed, not disabled — see the header. `transition` so the row
        // fades as the meeting ends rather than blinking.
        className={`px-4 py-3 transition-opacity sm:px-5 ${past ? 'opacity-55' : ''}`}
      >
        {/* The whole line opens the write-up, already filled in with who was
            there, when it was and what it was called. Sjoerd, 2026-09-21:
            "when clicking the item... I like to see the popup of What
            happened". It was only the title until now, which is why he was
            clicking and getting nothing. The links below stay their own
            targets — a button cannot contain a link. */}
        <button
          type="button"
          onClick={() => setWriting(ev)}
          className="flex w-full items-baseline justify-between gap-3 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {ev.summary || t(locale, 'agenda_untitled')}
          </span>
          <span className="shrink-0 text-xs text-ink-muted tabular-nums">
            {ev.all_day ? t(locale, 'agenda_all_day') : clock(ev.start, intl)}
          </span>
        </button>

        <MeetingWhere ev={ev} locale={locale} />

        {ev.people.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ev.people.map((p) => {
              const ago = since(p.last_note_at, intl);
              if (p.person_id) {
                return (
                  <li key={p.email}>
                    <PersonLink
                      personId={p.person_id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs transition-colors hover:border-ink/40"
                    >
                      <span className="font-medium">{p.person_name}</span>
                      {p.rung && <span className="text-ink-subtle">· {bandLabel(p.rung)}</span>}
                      <span className="text-ink-subtle">
                        · {ago ?? t(locale, 'agenda_never_written')}
                      </span>
                    </PersonLink>
                  </li>
                );
              }
              return (
                <li key={p.email}>
                  <AddAttendee email={p.email} name={p.calendar_name} locale={locale} />
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <ul className={`mt-3 ${ROW_LIST}`}>
      {allDay.map(row)}
      {timed.map((ev, i) => (
        <Fragmentish key={ev.id}>
          {i === lineAt && <NowLine now={now!} intl={intl} locale={locale} />}
          {row(ev)}
        </Fragmentish>
      ))}
      {lineAt === timed.length && timed.length > 0 && (
          <NowLine now={now!} intl={intl} locale={locale} />
        )}
      </ul>

      {/* Outside the list, and therefore outside any row's opacity. */}
      <MeetingWriteUp event={writing} locale={locale} onClose={() => setWriting(null)} />
    </>
  );
}

/** A <li> may not be wrapped in a <div>, and two siblings need a key. */
function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Where you are in the day. Not a row — it carries no content and no target,
 *  so it is hidden from a screen reader, which gets the times on the rows. */
function NowLine({ now, intl, locale }: { now: number; intl: string; locale: Locale }) {
  return (
    <li aria-hidden className="flex items-center gap-2 px-4 py-1 sm:px-5">
      <span className="text-[11px] font-medium tabular-nums text-ink" suppressHydrationWarning>
        {clock(new Date(now).toISOString(), intl)}
      </span>
      <span className="h-px flex-1 bg-ink/30" />
      <span className="sr-only">{t(locale, 'agenda_now')}</span>
    </li>
  );
}

function MeetingWhere({ ev, locale }: { ev: AgendaEvent; locale: Locale }) {
  const join = joinLink(ev.location, ev.conference_url);
  const place = placeLink(ev.location);
  if (!join && !place) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
