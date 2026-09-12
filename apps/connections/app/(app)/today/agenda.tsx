import { PersonLink } from '@/components/person-popup';
import { Clock, MapPin, UserPlus } from 'lucide-react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { BAND_KEYS } from '../landscape/axes';

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
// row offers it.

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
        <h2 className="text-sm font-medium">{t(locale, 'agenda_heading')}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t(locale, 'agenda_unavailable')}</p>
      </section>
    );
  }

  if (data.events.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-medium">{t(locale, 'agenda_heading')}</h2>
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
      <h2 className="text-sm font-medium">{t(locale, 'agenda_heading')}</h2>

      <ul className="mt-3 space-y-2">
        {data.events.map((ev) => (
          <li key={ev.id} className="rounded-lg border border-line bg-surface-raised p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted tabular-nums">
                <Clock size={13} />
                {ev.all_day ? t(locale, 'agenda_all_day') : clock(ev.start, locale, intl)}
              </span>
              <span className="text-sm font-medium">
                {ev.summary || t(locale, 'agenda_untitled')}
              </span>
              {ev.location && (
                <span className="inline-flex min-w-0 items-center gap-1 text-xs text-ink-subtle">
                  <MapPin size={12} className="shrink-0" />
                  <span className="truncate">{ev.location}</span>
                </span>
              )}
            </div>

            {ev.people.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
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
                          {p.rung && (
                            <span className="text-ink-subtle">{bandLabel(p.rung)}</span>
                          )}
                          {/* Whether you have written anything down about
                              them, and how long ago. This is the nudge: an
                              old date next to somebody you are meeting in an
                              hour is the whole reason to look at this page. */}
                          <span className="text-ink-subtle">
                            {ago ?? t(locale, 'agenda_never_written')}
                          </span>
                        </PersonLink>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={p.email}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line px-3 text-xs text-ink-subtle"
                      title={p.email}
                    >
                      <UserPlus size={12} />
                      <span className="max-w-[14rem] truncate">
                        {p.calendar_name || p.email}
                      </span>
                      <span>{t(locale, 'agenda_not_yours')}</span>
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
