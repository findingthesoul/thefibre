'use client';

// Minimal booking flow — date+time picker (any future weekday slot, no
// calendar-conflict checking yet — that's step 4), intake form, submit.
// Successful POST redirects to /[host]/[mt]/confirmed/[booking_id].

import { useMemo, useState, useTransition } from 'react';
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

const SLOT_HOURS = [9, 10, 11, 13, 14, 15, 16];

export function BookingFlow({ host, meetingType }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => {
    const out: Date[] = [];
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(start.getMinutes() + meetingType.min_notice_minutes);
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < Math.min(meetingType.max_advance_days, 14); i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends in step 2
      out.push(d);
    }
    return out;
  }, [meetingType.min_notice_minutes, meetingType.max_advance_days]);

  const [selectedDay, setSelectedDay] = useState<Date | null>(days[0] ?? null);

  function pickSlot(day: Date, hour: number) {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    setSelectedSlot(d);
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
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
            {days.map((d) => {
              const sel = selectedDay?.toDateString() === d.toDateString();
              return (
                <li key={d.toISOString()}>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`block w-full text-left px-4 py-3 text-sm ${
                      sel ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                    }`}
                  >
                    {d.toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            Pick a time ({host.timezone})
          </div>
          {selectedDay ? (
            <div className="grid grid-cols-2 gap-2">
              {SLOT_HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => pickSlot(selectedDay, h)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  {String(h).padStart(2, '0')}:00
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Pick a day first.</p>
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
          {selectedSlot?.toLocaleString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
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
