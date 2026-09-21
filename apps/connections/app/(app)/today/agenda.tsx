import { PersonLink } from '@/components/person-popup';
import { MapPin, Video } from 'lucide-react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { BAND_KEYS } from '../landscape/axes';
import { ROW_LIST } from '@thefibre/shared/ui/recipes';
import { AddAttendee } from './agenda-add';
import { MeetingWriteUp } from './meeting-note';
import { joinLink, placeLink, type JoinKind } from '@/lib/meeting-links';
import { CalendarPicker } from './calendar-picker';

// Today's calendar, with the people already found.
//
// Sjoerd, 2026-09-12: *"would be great if the app — when you open it — based
// on agenda — can pre select people from the DB, that are named in the
// agenda"*.
//
// The row is a meeting; the point of the row is the NAMES under it. Each
// known person is a link into their page, which is where the note gets
// written — so the path from "I have a meeting at 11" to "here is what we
// said" is one tap, and the app has done the looking-up.
//
// An attendee with no person is shown too, greyed, with their address. That
// is deliberate: an unmatched attendee is the most useful thing on this
// screen, because it is somebody you are about to meet who is not in your
// people yet. Nothing is created automatically (see the route header); the
// chip offers it, and since 2026-09-21 pressing it adds them (agenda-add.tsx).
//
// Which calendars this reads is the reader's own choice (calendar-picker.tsx),
// defaulting to the ones they own.

export type AgendaPerson = {
  email: string;
  calendar_name: string | null;
  person_id: string | null;
  person_name: string | null;
  rung: string | null;
  last_note_at: string | null;
};

export type AgendaEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  all_day: boolean;
  location: string | null;
  /** The calendar's own conferencing entry, when the meeting has one. */
  conference_url: string | null;
  people: AgendaPerson[];
  known: number;
};

export type AgendaPayload = {
  connected: boolean;
  unavailable?: boolean;
  events: AgendaEvent[];
};

function clock(iso: string, locale: Locale, intl: string): string {
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
function since(iso: string | null, locale: Locale, intl: string): string | null {
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

export function Agenda({
  data,
  locale,
  intl,
  labels,
}: {
  data: AgendaPayload;
  locale: Locale;
  intl: string;
  /** What this workspace calls its bands, so a standing next to a name reads
   *  the same here as it does on the landscape. */
  labels?: Record<string, Record<string, string>>;
}) {
  // Not connected is not a failure and gets no banner — most people will
  // never connect a calendar, and a permanent notice about an optional
  // integration is furniture. Nothing renders at all.
  if (!data.connected) return null;

  if (data.unavailable) {
    return (
      <section className="mt-8">
        <AgendaHeading locale={locale} />
        <p className="mt-2 text-sm text-ink-muted">{t(locale, 'agenda_unavailable')}</p>
      </section>
    );
  }

  if (data.events.length === 0) {
    return (
      <section className="mt-8">
        <AgendaHeading locale={locale} />
        {/* An empty day is the likeliest moment to discover the agenda is
            reading the wrong calendar, so the picker is on this screen too. */}
        <p className="mt-2 text-sm text-ink-muted">{t(locale, 'agenda_empty')}</p>
      </section>
    );
  }

  const bandLabel = (band: string) => {
    const own = labels?.maturity?.[band];
    if (own) return own;
    const k: UiKey | undefined = BAND_KEYS.maturity[band];
    return k ? t(locale, k) : band;
  };

  return (
    <section className="mt-8">
      <AgendaHeading locale={locale} />

      {/* A LIST, not a stack of cards. Sjoerd, 2026-09-21, holding this page
          next to iOS Recents and Gmail: *"on photo 1 you see what it is...
          but on 2 and 3 you see what is regular on apps. The later is more
          intuitive."* Both references are the same shape — rows to the screen
          edges, a hairline between them, a bold line and a quiet line on the
          left, the time on the right — and a card per row is the thing that
          made this read as something else. ROW_LIST is that shape, shared
          with the people list. */}
      <ul className={`mt-3 ${ROW_LIST}`}>
        {data.events.map((ev) => (
          <li key={ev.id} className="px-4 py-3 sm:px-5">
            <div className="flex items-baseline justify-between gap-3">
              {/* The title opens the write-up, already filled in with who
                  was there, when it was and what it was called. Sjoerd,
                  2026-09-21: "when click on the meeting, it should open and
                  select the people present". */}
              <MeetingWriteUp
                event={ev}
                locale={locale}
                className="min-w-0 flex-1 text-left text-sm font-medium"
              >
                <span className="block truncate">
                  {ev.summary || t(locale, 'agenda_untitled')}
                </span>
              </MeetingWriteUp>
              {/* On the right, where every list app puts the time. */}
              <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                {ev.all_day ? t(locale, 'agenda_all_day') : clock(ev.start, locale, intl)}
              </span>
            </div>

            <MeetingWhere ev={ev} locale={locale} />

            {ev.people.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {ev.people.map((p) => {
                  const ago = since(p.last_note_at, locale, intl);
                  if (p.person_id) {
                    return (
                      <li key={p.email}>
                        {/* Opens in the popup, so writing the note after a
                            meeting never costs leaving Today. */}
                        <PersonLink
                          personId={p.person_id}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs transition-colors hover:border-ink/40"
                        >
                          <span className="font-medium">{p.person_name}</span>
                          {/* Separated. Three facts run together read as one
                              long phrase — "Tahirih Michot Contributes
                              nothing written down" was on Sjoerd's screen on
                              2026-09-21. A middle dot is what every list app
                              puts between a name and its detail. */}
                          {p.rung && (
                            <span className="text-ink-subtle">· {bandLabel(p.rung)}</span>
                          )}
                          {/* Whether you have written anything down about
                              them, and how long ago. This is the nudge: an
                              old date next to somebody you are meeting in an
                              hour is the whole reason to look at this page. */}
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
        ))}
      </ul>
    </section>
  );
}

/** The heading, with the way to change what it reads. One component because
 *  all three states of this section carry it — including the empty day, which
 *  is when somebody is most likely to want it. */
function AgendaHeading({ locale }: { locale: Locale }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-medium">{t(locale, 'agenda_heading')}</h2>
      <CalendarPicker locale={locale} />
    </div>
  );
}

/** How to get to the meeting: the way in, the place, or both.
 *
 *  Sjoerd, 2026-09-21: *"if locations of meetings in the agenda are filled
 *  in: location -> maps or any mobile app using, zoom/teams: link opens
 *  app."* Nothing here integrates with anybody — a phone decides which app
 *  opens a link from the link itself. What this needs is only to tell a place
 *  from a way in, which lib/meeting-links.ts does, because the location field
 *  is one box that people put both kinds of thing in. */
const JOIN_KEYS: Record<JoinKind, UiKey> = {
  meet: 'agenda_join_meet',
  zoom: 'agenda_join_zoom',
  teams: 'agenda_join_teams',
  video: 'agenda_join',
};

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
          // noreferrer as well as noopener: a meeting link goes to somebody
          // else's site, and where it was opened from is not their business.
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
