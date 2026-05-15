'use client';

// Booking flow — right pane of the public booking card.
// Two steps:
//   pick    — month-grid calendar + time list + timezone + 24h/AMPM toggle
//   details — selected slot summary + name/email/intake + confirm
//
// Slots come from /api/v1/meet/public/{host|team}/.../slots — the ownerKind
// prop selects which endpoint.

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IntakeFieldsRenderer } from '@/components/intake-fields-renderer';
import type { IntakeField } from '@/lib/intake';
import { publicFetch, PublicApiError } from '@/lib/public-api';

type Props = {
  ownerSlug: string;
  ownerKind: 'host' | 'team';
  hostTimezone: string;
  meetingType: {
    id: string;
    slug: string;
    duration_minutes: number;
    min_notice_minutes: number;
    max_advance_days: number;
    intake_form: { fields: IntakeField[] } | null;
  };
};

type Clock = '24h' | 'ampm';

// YYYY-MM-DD in a given timezone.
function dateKey(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function formatTime(d: Date, tz: string, clock: Clock): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: clock === 'ampm',
  }).format(d);
}

function formatLongDate(dateStr: string, tz: string): string {
  // dateStr is YYYY-MM-DD (already in tz). Render in that tz.
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function tzOptions(): string[] {
  // Browser support: Intl.supportedValuesOf is ES2022. Fall back to a curated list.
  type IntlExt = typeof Intl & { supportedValuesOf?: (k: string) => string[] };
  const fn = (Intl as IntlExt).supportedValuesOf;
  if (typeof fn === 'function') {
    try {
      return fn('timeZone');
    } catch {
      // fallthrough
    }
  }
  return [
    'UTC',
    'Europe/Amsterdam',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Dubai',
    'Australia/Sydney',
  ];
}

function detectTz(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

export function BookingFlow({
  ownerSlug,
  ownerKind,
  hostTimezone,
  meetingType,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [tz, setTz] = useState<string>(() => detectTz(hostTimezone));
  const [clock, setClock] = useState<Clock>('24h');

  const slotsBasePath =
    ownerKind === 'team'
      ? `/api/v1/meet/public/team/${encodeURIComponent(ownerSlug)}/mt/${encodeURIComponent(meetingType.slug)}/slots`
      : `/api/v1/meet/public/host/${encodeURIComponent(ownerSlug)}/mt/${encodeURIComponent(meetingType.slug)}/slots`;

  const [slots, setSlots] = useState<Date[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const to = new Date(
      now.getTime() +
        Math.min(meetingType.max_advance_days, 60) * 24 * 60 * 60 * 1000,
    );
    setLoadingSlots(true);
    setSlotsError(null);
    publicFetch<{ slots: string[] }>(
      `${slotsBasePath}?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    )
      .then((r) => {
        if (cancelled) return;
        setSlots(r.slots.map((s) => new Date(s)));
      })
      .catch((e) => {
        if (cancelled) return;
        setSlotsError(
          e instanceof PublicApiError ? `API ${e.status}` : 'Could not load slots.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slotsBasePath, meetingType.max_advance_days]);

  // Slots indexed by their date-key in the viewer's tz.
  const slotsByDate = useMemo(() => {
    const m = new Map<string, Date[]>();
    for (const s of slots ?? []) {
      const k = dateKey(s, tz);
      const a = m.get(k) ?? [];
      a.push(s);
      m.set(k, a);
    }
    return m;
  }, [slots, tz]);

  const availableDates = useMemo(
    () => new Set(slotsByDate.keys()),
    [slotsByDate],
  );

  // Month displayed in the calendar. Defaults to the month of the first slot
  // (or current month if none).
  const [displayed, setDisplayed] = useState<{ year: number; month: number }>(
    () => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    },
  );
  useEffect(() => {
    const first = slots?.[0];
    if (!first) return;
    const k = dateKey(first, tz);
    const [y, m] = k.split('-').map(Number);
    if (y && m) setDisplayed({ year: y, month: m });
  }, [slots, tz]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [stagedSlot, setStagedSlot] = useState<Date | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function confirmSlot(s: Date) {
    setSelectedSlot(s);
    setStep('details');
  }

  function submit() {
    setError(null);
    if (!selectedSlot || !name.trim() || !email.trim()) {
      setError('Name, email, and a time slot are required.');
      return;
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    start(async () => {
      try {
        const r = await publicFetch<{ booking: { id: string } }>(
          '/api/v1/meet/public/bookings',
          {
            method: 'POST',
            body: JSON.stringify({
              meeting_type_id: meetingType.id,
              invitee_email: email.trim().toLowerCase(),
              invitee_name: name.trim(),
              invitee_answers: answers,
              starts_at: selectedSlot.toISOString(),
              request_id: requestId,
            }),
          },
        );
        router.push(`/${ownerSlug}/${meetingType.slug}/confirmed/${r.booking.id}`);
      } catch (e) {
        if (e instanceof PublicApiError) {
          setError(`Couldn't book (${e.status}). Please try again.`);
        } else {
          setError('Network error. Please try again.');
        }
      }
    });
  }

  if (step === 'pick') {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900">
          Select a date &amp; time
        </h2>

        {loadingSlots ? (
          <p className="text-sm text-neutral-500">Loading availability…</p>
        ) : slotsError ? (
          <p className="text-sm text-red-700">{slotsError}</p>
        ) : (slots ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">
            No availability in the next {Math.min(meetingType.max_advance_days, 60)} days.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_220px]">
            <CalendarGrid
              displayed={displayed}
              setDisplayed={setDisplayed}
              availableDates={availableDates}
              selectedDate={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d);
                setStagedSlot(null);
              }}
            />

            <div className="md:max-h-[360px] md:overflow-y-auto md:pr-1">
              {!selectedDate ? (
                <p className="text-sm text-neutral-500 pt-4">
                  Pick a date to see times.
                </p>
              ) : (slotsByDate.get(selectedDate) ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500 pt-4">
                  No times on this day.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-900 pb-1">
                    {formatLongDate(selectedDate, tz)}
                  </p>
                  {(slotsByDate.get(selectedDate) ?? []).map((s) => {
                    const isStaged = stagedSlot?.getTime() === s.getTime();
                    return (
                      <div key={s.toISOString()} className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setStagedSlot(isStaged ? null : s)}
                          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            isStaged
                              ? 'border-neutral-900 bg-neutral-100 text-neutral-900'
                              : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300'
                          }`}
                        >
                          {formatTime(s, tz, clock)}
                        </button>
                        {isStaged && (
                          <button
                            type="button"
                            onClick={() => confirmSlot(s)}
                            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                          >
                            Next
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center gap-3 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="text-neutral-500">Time zone:</span>
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
          >
            {tzOptions().map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="ml-auto inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setClock('24h')}
              className={`px-2.5 py-1 rounded-[5px] font-medium ${
                clock === '24h' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
              }`}
            >
              24h
            </button>
            <button
              type="button"
              onClick={() => setClock('ampm')}
              className={`px-2.5 py-1 rounded-[5px] font-medium ${
                clock === 'ampm' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
              }`}
            >
              AM/PM
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === 'details'
  return (
    <div className="max-w-lg">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <div className="text-neutral-500 text-xs uppercase tracking-wider">
          Selected
        </div>
        <div className="mt-1 font-medium">
          {selectedSlot &&
            new Intl.DateTimeFormat(undefined, {
              timeZone: tz,
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
              hour12: clock === 'ampm',
            }).format(selectedSlot)}{' '}
          <span className="text-neutral-500">({tz})</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setStep('pick');
            setSelectedSlot(null);
            setStagedSlot(null);
          }}
          className="mt-2 text-xs underline text-neutral-600"
        >
          Change time
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="b-name">Your name</Label>
          <Input
            id="b-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="b-email">Email</Label>
          <Input
            id="b-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {meetingType.intake_form && meetingType.intake_form.fields.length > 0 && (
          <div className="pt-2 border-t border-neutral-200">
            <IntakeFieldsRenderer
              fields={meetingType.intake_form.fields}
              answers={answers}
              onChange={setAnswers}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Booking…' : 'Confirm booking'}
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Month-grid calendar — Monday-first, available days are clickable + dotted.
// ──────────────────────────────────────────────────────────────────────────
function CalendarGrid({
  displayed,
  setDisplayed,
  availableDates,
  selectedDate,
  onSelect,
}: {
  displayed: { year: number; month: number };
  setDisplayed: (d: { year: number; month: number }) => void;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(displayed.year, displayed.month - 1, 1));

  const firstDow = new Date(displayed.year, displayed.month - 1, 1).getDay();
  const offset = (firstDow + 6) % 7; // shift Sun=0..Sat=6 to Mon=0..Sun=6
  const daysInMonth = new Date(displayed.year, displayed.month, 0).getDate();

  const cells: ({ key: string; day: number; date: string } | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${displayed.year}-${String(displayed.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ key: date, day: d, date });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    let m = displayed.month + delta;
    let y = displayed.year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setDisplayed({ year: y, month: m });
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div>
      <div className="flex items-center justify-between pb-3">
        <p className="text-sm font-medium text-neutral-900">{monthLabel}</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 py-2"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} aria-hidden="true" />;
          const isAvailable = availableDates.has(cell.date);
          const isSelected = selectedDate === cell.date;
          const isToday = cell.date === todayKey;
          const base =
            'relative aspect-square flex items-center justify-center rounded-md text-sm';
          if (!isAvailable) {
            return (
              <div
                key={cell.key}
                className={`${base} text-neutral-300 cursor-not-allowed`}
                aria-disabled="true"
              >
                <span>{cell.day}</span>
              </div>
            );
          }
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(cell.date)}
              className={`${base} font-medium ${
                isSelected
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-50 text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <span>{cell.day}</span>
              {isToday && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-neutral-900" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
