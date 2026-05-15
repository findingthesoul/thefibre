'use client';

// Booking flow — day list (built from real slots) → time list → details +
// intake → submit. Slots come from /api/v1/meet/public/host/:slug/mt/:slug/slots
// which applies the host's working_hours + meeting-type constraints + existing-booking
// conflicts. Google Calendar conflict checking comes in step 4b.

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IntakeFieldsRenderer } from '@/components/intake-fields-renderer';
import type { IntakeField } from '@/lib/intake';
import { publicFetch, PublicApiError } from '@/lib/public-api';

type Props = {
  host: { slug: string; timezone: string };
  meetingType: {
    id: string;
    slug: string;
    duration_minutes: number;
    min_notice_minutes: number;
    max_advance_days: number;
    intake_form: { fields: IntakeField[] } | null;
  };
};

function dateKey(d: Date, timeZone: string): string {
  // YYYY-MM-DD in the host's local timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function formatDayLabel(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function formatTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function BookingFlow({ host, meetingType }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const [slots, setSlots] = useState<Date[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const to = new Date(
      now.getTime() +
        Math.min(meetingType.max_advance_days, 30) * 24 * 60 * 60 * 1000,
    );
    setLoadingSlots(true);
    setSlotsError(null);
    publicFetch<{ slots: string[] }>(
      `/api/v1/meet/public/host/${encodeURIComponent(host.slug)}/mt/${encodeURIComponent(meetingType.slug)}/slots?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
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
  }, [host.slug, meetingType.slug, meetingType.max_advance_days]);

  // Group slots by day in host timezone.
  const slotsByDay = useMemo(() => {
    if (!slots) return new Map<string, Date[]>();
    const map = new Map<string, Date[]>();
    for (const s of slots) {
      const k = dateKey(s, host.timezone);
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return map;
  }, [slots, host.timezone]);

  const days = useMemo(() => {
    const keys = Array.from(slotsByDay.keys()).sort();
    return keys.map((k) => slotsByDay.get(k)![0]).filter((d): d is Date => !!d);
  }, [slotsByDay]);

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedDayKey && days.length > 0 && days[0]) {
      setSelectedDayKey(dateKey(days[0], host.timezone));
    }
  }, [days, selectedDayKey, host.timezone]);

  const selectedDaySlots = selectedDayKey ? slotsByDay.get(selectedDayKey) ?? [] : [];

  function pickSlot(s: Date) {
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
        router.push(`/${host.slug}/${meetingType.slug}/confirmed/${r.booking.id}`);
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
      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            Pick a day
          </div>
          {loadingSlots ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : slotsError ? (
            <p className="text-sm text-red-700">{slotsError}</p>
          ) : days.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No availability in the next 30 days.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
              {days.map((d) => {
                const k = dateKey(d, host.timezone);
                const sel = selectedDayKey === k;
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setSelectedDayKey(k)}
                      className={`block w-full text-left px-4 py-3 text-sm ${
                        sel ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                      }`}
                    >
                      {formatDayLabel(d, host.timezone)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            Pick a time ({host.timezone})
          </div>
          {selectedDaySlots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedDaySlots.map((s) => (
                <button
                  key={s.toISOString()}
                  type="button"
                  onClick={() => pickSlot(s)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  {formatTime(s, host.timezone)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              {selectedDayKey
                ? 'No times available on this day.'
                : 'Pick a day first.'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <div className="text-neutral-500 text-xs uppercase tracking-wider">
          Selected
        </div>
        <div className="mt-1 font-medium">
          {selectedSlot &&
            new Intl.DateTimeFormat(undefined, {
              timeZone: host.timezone,
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }).format(selectedSlot)}
        </div>
        <button
          type="button"
          onClick={() => {
            setStep('pick');
            setSelectedSlot(null);
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
