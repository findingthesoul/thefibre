import { t, type Locale } from '@/lib/i18n-ui';
import { AgendaDay } from './agenda-day';
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
// defaulting to the ones they own. The DAY — what has passed as well as what
// has not, and a line where now is — lives in agenda-day.tsx, which is a
// client component because the only clock that can place that line is the
// viewer's.
//
// This file is what is left: the heading, and the three states that are not
// a list.

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

  return (
    <section className="mt-8">
      {/* The heading carries the way to change what it reads, in all three
          states — an empty day is the likeliest moment to discover the agenda
          is reading the wrong calendar. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{t(locale, 'agenda_heading')}</h2>
        <CalendarPicker locale={locale} />
      </div>

      {data.unavailable ? (
        <p className="mt-2 text-sm text-ink-muted">{t(locale, 'agenda_unavailable')}</p>
      ) : data.events.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{t(locale, 'agenda_empty')}</p>
      ) : (
        <AgendaDay events={data.events} locale={locale} intl={intl} labels={labels} />
      )}
    </section>
  );
}
