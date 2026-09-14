'use client';

// The landscape as columns, the way Finder browses a disk.
//
// Sjoerd, 2026-09-13: *"Landscape: would be nice if this works like 'As
// columns' in OsX."* Lost that day, logged as missed, asked about twice more
// before it was built — see docs/connections-asks.md, row 20.
//
//   READINGS  →  STEPS in that reading  →  PEOPLE on that step  →  THE PERSON
//
// Each choice opens the next column to its right and leaves the ones before
// it standing. That is the whole point of the Finder shape: you can always
// see how you got where you are, and stepping back one level is one click on
// a column that is still on screen, not a trip back to the start.
//
// ── The person is inline, not a popup ──────────────────────────────────────
//
// Asked, not answered, so decided: the fourth column shows the person — how to
// reach them, how you know them, what happened — rather than opening the popup
// over the columns. A popup would cover the very path the columns exist to
// keep visible, and the reason to walk down to a person is usually to call them
// and write one line. Same components as the popup (ContactRow,
// RelationshipCard, Notes), so the two cannot drift.
//
// ── Where the data comes from ──────────────────────────────────────────────
//
// One request per READING, not per click: `loadReading` returns the steps AND
// every person's step, so picking a step lists its people without asking the
// server again. Names come from the vocabulary the composer already loads.
// Readings already opened are kept, so going back and forth costs nothing.
//
// ── The URL holds the path ─────────────────────────────────────────────────
//
// `?axis=…&band=…&person=…`, replaced rather than pushed: Back leaves the
// landscape instead of undoing one click at a time through every row somebody
// hovered on the way. A path can still be bookmarked and shared.
//
// ── On a phone ─────────────────────────────────────────────────────────────
//
// Four columns do not fit 375px and a page that scrolls sideways is forbidden
// here. Below `md` only the deepest open column is shown, with a back arrow to
// the one before — which is what Finder does in a narrow window too.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import {
  AXIS_QUESTION_KEYS,
  BAND_NOTE_KEYS,
  axisTitle,
  bandName,
  type Axis,
  type AxisConfig,
  type BandLabels,
} from './axes';
import { loadReading, type ReadingResult } from './actions';
import { fetchVocabulary } from '@/app/(app)/people/[id]/actions';
import { loadPerson, type PersonCard } from '@/app/(app)/people/[id]/load';
import { Notes, type Note } from '@/app/(app)/people/[id]/notes';
import { ContactRow } from '@/components/contact-row';
import { RelationshipCard } from '@/components/relationship-card';

type Level = 'reading' | 'step' | 'people' | 'person';

export function LandscapeColumns({
  locale,
  axes,
  config,
  labels,
  initialAxis,
  initialBand,
  initialPerson,
  initialReading,
}: {
  locale: Locale;
  /** The readings this workspace has switched on, in order. */
  axes: readonly Axis[];
  config?: AxisConfig;
  labels?: BandLabels;
  initialAxis: Axis;
  initialBand: string | null;
  initialPerson: string | null;
  /** The first reading, fetched on the server so the page is never blank. */
  initialReading: ReadingResult;
}) {
  const router = useRouter();
  // The page this lives on, rather than a hard-coded /landscape, so the path
  // stays on whatever page mounted it.
  const pathname = usePathname();
  const [axis, setAxis] = useState<Axis>(initialAxis);
  const [band, setBand] = useState<string | null>(initialBand);
  const [personId, setPersonId] = useState<string | null>(initialPerson);
  const [readings, setReadings] = useState<Partial<Record<Axis, ReadingResult>>>({
    [initialAxis]: initialReading,
  });
  const [names, setNames] = useState<Map<string, string>>(new Map());

  // The path lives in the URL. Replace, not push — see the header.
  useEffect(() => {
    const qs = new URLSearchParams({ axis });
    if (band) qs.set('band', band);
    if (personId) qs.set('person', personId);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }, [axis, band, personId, router, pathname]);

  useEffect(() => {
    let alive = true;
    void fetchVocabulary().then((v) => {
      if (alive) setNames(new Map(v.people.map((p) => [p.id, p.name])));
    });
    return () => {
      alive = false;
    };
  }, []);

  const openReading = useCallback(
    async (next: Axis) => {
      setAxis(next);
      setBand(null);
      setPersonId(null);
      if (readings[next]) return;
      const r = await safely(
        () => loadReading(next),
        (error) => ({ ok: false as const, error }),
      );
      setReadings((prev) => ({ ...prev, [next]: r }));
    },
    [readings],
  );

  const reading = readings[axis];
  const people = useMemo(() => {
    if (!reading?.ok || !band) return [];
    return reading.people
      .filter((p) => p.rung === band)
      .map((p) => ({ id: p.person_id, name: names.get(p.person_id) ?? '' }))
      // A person the vocabulary has not named yet sorts last rather than
      // showing as a blank row at the top.
      .sort((a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || a.name.localeCompare(b.name));
  }, [reading, band, names]);

  // The deepest open level — what a phone shows.
  const level: Level = personId ? 'person' : band ? 'people' : 'step';
  const back = () => {
    if (personId) setPersonId(null);
    else if (band) setBand(null);
  };

  const column = 'min-h-0 overflow-y-auto border-line';
  const phoneHidden = (l: Level) => (l === level ? '' : 'hidden md:block');

  return (
    <div className="mt-6">
      {/* A phone shows one column; this is the way back to the one before. */}
      {level !== 'step' && (
        <button
          type="button"
          onClick={back}
          className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink md:hidden"
        >
          <ChevronLeft size={15} />
          {t(locale, 'landscape_back')}
        </button>
      )}

      <div className="grid h-[70vh] min-h-[28rem] grid-cols-1 overflow-hidden rounded-lg border border-line bg-surface-raised md:grid-cols-[11rem_13rem_14rem_minmax(0,1fr)]">
        {/* 1 · Readings. On a phone the steps column carries the reading as a
            picker instead, so there is always somewhere to change it. */}
        <div className={`${column} hidden border-r md:block`}>
          <ColumnHead>{t(locale, 'landscape_col_readings')}</ColumnHead>
          <ul>
            {axes.map((a) => (
              <Row key={a} on={a === axis} open onClick={() => void openReading(a)}>
                {axisTitle(locale, config, a)}
              </Row>
            ))}
          </ul>
        </div>

        {/* 2 · Steps in the chosen reading. */}
        <div className={`${column} border-r ${phoneHidden('step')}`}>
          <ColumnHead>
            <select
              value={axis}
              onChange={(e) => void openReading(e.target.value as Axis)}
              className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs md:hidden"
              aria-label={t(locale, 'landscape_col_readings')}
            >
              {axes.map((a) => (
                <option key={a} value={a}>
                  {axisTitle(locale, config, a)}
                </option>
              ))}
            </select>
            <span className="hidden md:inline">{t(locale, 'landscape_col_steps')}</span>
          </ColumnHead>
          <p className="px-3 pb-2 text-xs text-ink-subtle">{t(locale, AXIS_QUESTION_KEYS[axis])}</p>
          {!reading && <p className="px-3 text-xs text-ink-muted">{t(locale, 'loading')}</p>}
          {reading && !reading.ok && <p className="px-3 text-xs text-ink">{reading.error}</p>}
          {reading?.ok && (
            <ul>
              {reading.bands.map((b) => (
                <Row
                  key={b.rung}
                  on={b.rung === band}
                  open
                  onClick={() => {
                    setBand(b.rung);
                    setPersonId(null);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{bandName(locale, labels, axis, b.rung)}</span>
                  <Movement net={b.net_moved} />
                  <span className="w-7 text-right tabular-nums text-ink-muted">{b.count}</span>
                </Row>
              ))}
            </ul>
          )}
          {reading?.ok && (
            <p className="px-3 pt-3 text-xs text-ink-subtle">
              {t(locale, 'landscape_period', {
                days: reading.sinceDays,
                arrived: reading.arrived,
                moved: reading.movedTotal,
              })}
            </p>
          )}
        </div>

        {/* 3 · People on the chosen step. */}
        <div className={`${column} border-r ${phoneHidden('people')}`}>
          <ColumnHead>
            {band ? bandName(locale, labels, axis, band) : t(locale, 'landscape_col_people')}
          </ColumnHead>
          {!band && <p className="px-3 text-xs text-ink-muted">{t(locale, 'landscape_pick_step')}</p>}
          {band && (() => {
            const note = BAND_NOTE_KEYS[axis][band];
            return note ? <p className="px-3 pb-2 text-xs text-ink-subtle">{t(locale, note)}</p> : null;
          })()}
          {band && people.length === 0 && (
            <p className="px-3 text-xs text-ink-muted">{t(locale, 'landscape_none_here')}</p>
          )}
          <ul>
            {people.map((p) => (
              <Row key={p.id} on={p.id === personId} open onClick={() => setPersonId(p.id)}>
                <span className="truncate">{p.name || '…'}</span>
              </Row>
            ))}
          </ul>
        </div>

        {/* 4 · The person, inline. */}
        <div className={`${column} ${phoneHidden('person')}`}>
          {!personId && (
            <p className="p-4 text-xs text-ink-muted">{t(locale, 'landscape_pick_person')}</p>
          )}
          {personId && <PersonColumn key={personId} personId={personId} locale={locale} />}
        </div>
      </div>
    </div>
  );
}

function ColumnHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center border-b border-line bg-surface-raised px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-subtle">
      {children}
    </div>
  );
}

function Row({
  on,
  open,
  onClick,
  children,
}: {
  on: boolean;
  /** Whether choosing it opens a column to the right — the Finder chevron. */
  open?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={on ? 'true' : undefined}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
          on ? 'bg-ink text-ink-inverse' : 'hover:bg-surface-sunken'
        }`}
      >
        {children}
        {open && <ChevronRight size={13} className={on ? 'opacity-80' : 'text-ink-subtle'} />}
      </button>
    </li>
  );
}

/** Net movement into a step over the period, as the old band view showed it. */
function Movement({ net }: { net: number }) {
  if (!net) return null;
  return (
    <span className="inline-flex items-center text-xs tabular-nums opacity-70">
      {net > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(net)}
    </span>
  );
}

/**
 * The fourth column: the same person the popup shows, laid out inline.
 *
 * Built from the popup's own pieces rather than a copy of it. What it leaves
 * out is the popup's chrome — the dialog, the tabs, the warning before leaving
 * — because a column has room for both halves at once.
 */
function PersonColumn({ personId, locale }: { personId: string; locale: Locale }) {
  const [person, setPerson] = useState<PersonCard | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await safely(() => loadPerson(personId), (e) => ({ ok: false as const, error: e }));
    if (!r.ok) return setError(r.error);
    setPerson(r.person);
    setNotes(r.notes);
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="p-4 text-sm text-ink">{t(locale, 'person_load_failed')} {error}</p>;
  if (!person) return <p className="p-4 text-xs text-ink-muted">{t(locale, 'loading')}</p>;

  const name =
    [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.email || '…';

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-medium">{name}</h2>
        <div className="mt-1">
          <ContactRow person={person} />
        </div>
      </div>
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-subtle">
          {t(locale, 'popup_relation')}
        </h3>
        <RelationshipCard personId={person.id} locale={locale} />
      </section>
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
          {t(locale, 'popup_what_happened')}
        </h3>
        <Notes
          personId={person.id}
          personName={name}
          notes={notes}
          locale={locale}
          onCommitted={() => void load()}
        />
      </section>
    </div>
  );
}
