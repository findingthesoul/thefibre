'use client';

// The day as a day: hours down the left, meetings drawn over the time they
// take.
//
// Sjoerd, 2026-09-22, with a screenshot of his own calendar: *"Make the
// agenda look like this (time on the left... appointments over the time they
// take)."* Before this it was a list, and a list cannot say the thing a grid
// says without being read: that there is an hour free between two meetings,
// or that the afternoon is solid.
//
// What the shape costs, said plainly because it is a real loss: the list
// carried every attendee as a chip under each meeting, and a half-hour block
// is thirty pixels tall. The names are now a single quiet line inside the
// block when it is tall enough, and the full list — with the people who are
// not on file yet, and a way to add them — is in the write-up the block
// opens. That keeps them one press away rather than on the surface.
//
// ── Time is the viewer's ───────────────────────────────────────────────────
//
// Every minute here is read off a Date in the browser, so it is the reader's
// clock and the reader's zone. The server's is UTC and would put an Amsterdam
// afternoon two hours out. Nothing is positioned until after mount for the
// same reason: a grid rendered on the server would be drawn wrong and then
// corrected, visibly.

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Users, Video } from 'lucide-react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { joinLink, placeLink, type JoinKind } from '@/lib/meeting-links';
import { hourRange, layoutDay, minutesOfDay, MIN_BLOCK_MIN, type Block } from '@/lib/day-grid';
import { AddAttendee } from './agenda-add';
import { MeetingWriteUp } from './meeting-note';
import type { AgendaEvent } from './agenda';

/** One hour, in pixels. The whole grid is this times the hours drawn. */
const HOUR = 52;
/** The time column. Wide enough for "07:00" and no wider. */
const GUTTER = 'pl-12';

const JOIN_KEYS: Record<JoinKind, UiKey> = {
  meet: 'agenda_join_meet',
  zoom: 'agenda_join_zoom',
  teams: 'agenda_join_teams',
  video: 'agenda_join',
};

/** Minutes from midnight as a clock time, in the reader's own convention —
 *  24-hour here, 2:30 PM in a locale that expects it. Built from a real Date
 *  because Intl formats instants, not durations; the date part is discarded. */
function hhmm(min: number, intl: string): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  try {
    return new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }
}

export function AgendaDay({
  events,
  locale,
  intl,
}: {
  events: AgendaEvent[];
  locale: Locale;
  intl: string;
}) {
  const [writing, setWriting] = useState<AgendaEvent | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(minutesOfDay(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const allDay = events.filter((e) => e.all_day);
  const timed = useMemo(() => events.filter((e) => !e.all_day), [events]);

  const blocks: Block[] = useMemo(
    () =>
      timed.map((e) => ({
        id: e.id,
        startMin: minutesOfDay(new Date(e.start)),
        endMin: minutesOfDay(new Date(e.end)),
      })),
    [timed],
  );

  const placed = useMemo(() => layoutDay(blocks), [blocks]);
  const { from, to } = useMemo(() => hourRange(blocks, now), [blocks, now]);
  const byId = new Map(timed.map((e) => [e.id, e]));

  const top = (min: number) => ((min - from * 60) / 60) * HOUR;

  return (
    <>
      {/* All-day first, as a strip. It has no place on a clock and "Home" is
          not over at eleven. */}
      {allDay.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {allDay.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => setWriting(ev)}
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 text-xs shadow-sm transition-colors hover:border-ink/40"
              >
                <span className="truncate">{ev.summary || t(locale, 'agenda_untitled')}</span>
                <span className="shrink-0 text-ink-subtle">{t(locale, 'agenda_all_day')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={`relative mt-3 ${GUTTER}`} style={{ height: (to - from) * HOUR }}>
        {/* The hours. A line and a label each, drawn behind everything. */}
        {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => (
          <div
            key={h}
            className="pointer-events-none absolute inset-x-0 flex items-center"
            style={{ top: (h - from) * HOUR }}
          >
            <span className="absolute -left-12 -translate-y-1/2 text-[11px] tabular-nums text-ink-muted">
              {hhmm(h * 60, intl)}
            </span>
            <span className="h-px w-full bg-line" />
          </div>
        ))}

        {/* The meetings. */}
        {placed.map((p) => {
          const ev = byId.get(p.id);
          if (!ev) return null;
          const height = (Math.max(p.endMin - p.startMin, MIN_BLOCK_MIN) / 60) * HOUR;
          const past = now !== null && p.endMin <= now;
          const names = ev.people
            .map((x) => x.person_name || x.calendar_name || x.email)
            .filter(Boolean);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setWriting(ev)}
              // A block is a CARD on the page's ground, and the ground here
              // is the cool slate `surface-sunken` (globals.css). So a block
              // is `surface-raised` — white — whether it has happened or
              // not. Sjoerd, 2026-09-22: *"BG color: contrast higher between
              // BG and calendar items"*. A past block used to be
              // surface-sunken, which is the page itself: it vanished.
              //
              // Past is quieter through its TEXT and its accent, never
              // through its background and never through `opacity` — opacity
              // would make this the containing block for any fixed-position
              // child, which is the v0.89.0 bug.
              className={`absolute overflow-hidden rounded-md border border-line border-l-[3px] bg-surface-raised px-2 py-1 text-left shadow-sm transition-colors ${
                past
                  ? 'border-l-line-strong text-ink-muted hover:border-ink/40 hover:text-ink'
                  : 'border-l-ink text-ink hover:border-ink/40'
              }`}
              style={{
                top: top(p.startMin),
                height: Math.max(height - 2, 18),
                left: `${(p.lane / p.lanes) * 100}%`,
                width: `calc(${100 / p.lanes}% - 2px)`,
              }}
            >
              <span className="block truncate text-xs font-medium leading-tight">
                {ev.summary || t(locale, 'agenda_untitled')}
              </span>
              {height >= 34 && (
                <span className="block truncate text-[11px] tabular-nums leading-tight text-ink-muted">
                  {hhmm(p.startMin, intl)}–{hhmm(p.endMin, intl)}
                </span>
              )}
              {height >= 50 && names.length > 0 && (
                <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] leading-tight text-ink-subtle">
                  <Users size={11} className="shrink-0" />
                  <span className="truncate">{names.join(', ')}</span>
                </span>
              )}
              {height >= 66 && <Where ev={ev} locale={locale} />}
            </button>
          );
        })}

        {/* Where you are in the day. */}
        {now !== null && now >= from * 60 && now <= to * 60 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 flex items-center"
            style={{ top: top(now) }}
          >
            <span className="absolute -left-12 -translate-y-1/2 rounded bg-ink px-1 text-[11px] font-medium tabular-nums text-ink-inverse">
              {hhmm(now, intl)}
            </span>
            <span className="h-px w-full bg-ink/40" />
          </div>
        )}
      </div>

      {/* Anybody in today's meetings who is not on file. Out of the blocks,
          which have no room, and kept on the surface rather than buried —
          somebody you are about to meet and do not have is the most useful
          thing this page knows (ask 104). */}
      <Strangers events={events} locale={locale} />

      {/* Outside every block, and therefore outside anything that could
          become its containing block. */}
      <MeetingWriteUp event={writing} locale={locale} onClose={() => setWriting(null)} />
    </>
  );
}

function Strangers({ events, locale }: { events: AgendaEvent[]; locale: Locale }) {
  // One entry per address, however many meetings it is in today.
  const seen = new Map<string, { email: string; name: string | null; sameName: { id: string; name: string }[] }>();
  for (const ev of events) {
    for (const p of ev.people) {
      if (p.person_id || seen.has(p.email)) continue;
      seen.set(p.email, { email: p.email, name: p.calendar_name, sameName: p.same_name ?? [] });
    }
  }
  if (seen.size === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs text-ink-muted">{t(locale, 'agenda_strangers')}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {[...seen.values()].map((p) => (
          <li key={p.email}>
            <AddAttendee email={p.email} name={p.name} locale={locale} sameName={p.sameName} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The way in and the place, inside a block tall enough to hold them. Not
 *  links: a button may not contain one, and the block is the button. The
 *  write-up it opens carries them as real links. */
function Where({ ev, locale }: { ev: AgendaEvent; locale: Locale }) {
  const join = joinLink(ev.location, ev.conference_url);
  const place = placeLink(ev.location);
  if (!join && !place) return null;
  return (
    <span className="mt-0.5 flex items-center gap-2 truncate text-[11px] leading-tight text-ink-subtle">
      {join && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Video size={11} />
          {t(locale, JOIN_KEYS[join.kind])}
        </span>
      )}
      {place && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{place.label}</span>
        </span>
      )}
    </span>
  );
}
