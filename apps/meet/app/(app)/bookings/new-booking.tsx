'use client';

// Adding an appointment yourself.
//
// Every booking used to arrive through the public page; a host could approve,
// cancel, reschedule and archive one, never make one (Sjoerd, 2026-09-28).
// The money question is the reason this is a dialog and not a single button:
// for a paid meeting type, "I agreed this on the phone" and "they still owe
// me" are different states, and the host is the only one who knows which.
//
// SEARCH FIRST (Sjoerd, 2026-10-07: the host could only type a name and an
// address, never pick somebody already in the database). The invitee is
// found with THE person picker, @thefibre/shared/ui/person-combobox, bound
// to Meet's own server-side search (meeting-types/actions searchPeople, the
// same binding the poll invites use). Picking fills name + email from the
// record, and the API links the booking to that person by the address, so
// recalling an address exactly is no longer how a booking finds its person.
// Typing stays: somebody new is typed in, exactly as before — "add as new"
// hands the typed text to the name field. Same shape as Thread's
// add-participant dialog.

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PersonCombobox, type PersonOption } from '@thefibre/shared/ui/person-combobox';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { t, type Locale } from '@/lib/i18n-ui';
import { createHostBooking, slotSeats } from './actions';
import { searchPeople } from '../meeting-types/actions';

export type BookableType = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  price_currency: string | null;
};

export function NewBookingButton({
  types,
  locale,
}: {
  types: BookableType[];
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [mtId, setMtId] = useState(types[0]?.id ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [payment, setPayment] = useState<'link' | 'invoice' | 'comp'>('link');
  const [notify, setNotify] = useState(true);
  /** Everybody else going into the SAME slot. Sjoerd, 2026-10-09: the host
   *  books several people into one meeting at once. Each becomes its own
   *  booking — one seat, one confirmation, one join link — because that is
   *  already what the API does per person, and a bulk endpoint would be a
   *  second copy of the capacity rule. */
  const [guests, setGuests] = useState<{ name: string; email: string }[]>([]);
  /** What the slot has left, straight from the API. Null until a meeting type
   *  and a time are both chosen, or when the lookup fails — in which case the
   *  form stops capping rather than guessing a number. */
  const [seats, setSeats] = useState<{ left: number; taken: number; capacity: number } | null>(null);
  const [partial, setPartial] = useState<string[] | null>(null);
  /** The host has said, explicitly, to go past the seats.
   *
   *  The dialog caps at the seat count by default, but it must not be
   *  STRICTER than the route: a cap the host cannot get past while the API
   *  would accept the booking is the same offer-versus-enforcement split as
   *  a button that offers what the server refuses, just pointing the other
   *  way. So the cap is a default, and this is the door out of it. */
  const [overCapacity, setOverCapacity] = useState(false);

  const mt = types.find((x) => x.id === mtId) ?? null;
  const paid = !!(mt?.price_cents && mt.price_cents > 0);
  const price =
    paid && mt
      ? new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: (mt.price_currency ?? 'EUR').toUpperCase(),
        }).format(mt.price_cents! / 100)
      : null;

  // What the picker last showed, so choosing a row can read that person's
  // ADDRESS: the combobox hands back (id, label), and the address is the one
  // field a booking cannot do without. Re-querying by label could match the
  // wrong row or none.
  const seen = useRef(new Map<string, PersonOption>());
  async function searchAndRemember(q: string): Promise<PersonOption[]> {
    const rows = await searchPeople(q);
    for (const r of rows) seen.current.set(r.id, r);
    return rows;
  }

  function pick(p: PersonOption | null, typed?: string) {
    if (!p) {
      // "Add as someone new": keep what they typed, they fill in the address.
      setPickedId('');
      if (typed) setName(typed);
      return;
    }
    setPickedId(p.id);
    setName([p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '');
    setEmail(p.email ?? '');
    // A person can exist without an address (Connect creates them that way).
    // Say which field is waiting rather than leaving a disabled Create button
    // to explain itself.
    setErr(p.email ? null : t(locale, 'person_has_no_email'));
  }

  // Ask the API how many seats this slot has left, so the form can refuse a
  // seventh person BEFORE the host types six names and loses one to a 409.
  // The number is the API's, not a guess: the same slotSeats() the booking
  // route enforces with.
  useEffect(() => {
    let alive = true;
    if (!mtId || !startsAt) {
      setSeats(null);
      return;
    }
    const when = new Date(startsAt);
    if (Number.isNaN(when.getTime())) {
      setSeats(null);
      return;
    }
    setOverCapacity(false);
    slotSeats(mtId, when.toISOString()).then((r) => {
      if (!alive) return;
      setSeats(
        r && typeof r.left === 'number'
          ? { left: r.left, taken: r.taken, capacity: r.capacity }
          : null,
      );
    });
    return () => {
      alive = false;
    };
  }, [mtId, startsAt]);

  /** Everybody this submit will try to book: the people already added, plus
   *  whatever is still sitting in the two fields. */
  function allGuests(): { name: string; email: string }[] {
    const typed = name.trim() && email.trim() ? [{ name: name.trim(), email: email.trim() }] : [];
    const out = [...guests, ...typed];
    // One booking per person, so the same address twice is a mistake rather
    // than two seats.
    return out.filter((g, i) => out.findIndex((o) => o.email.toLowerCase() === g.email.toLowerCase()) === i);
  }

  function addGuest(person?: { name: string; email: string }) {
    const g = person ?? { name: name.trim(), email: email.trim() };
    if (!g.name || !g.email) return;
    if (guests.some((x) => x.email.toLowerCase() === g.email.toLowerCase())) return;
    setGuests((xs) => [...xs, g]);
    setName('');
    setEmail('');
    setPickedId('');
    setErr(null);
  }

  function submit() {
    setErr(null);
    setPartial(null);
    const people = allGuests();
    if (!people.length) return;
    startTransition(async () => {
      const when = new Date(startsAt).toISOString();
      const missed: string[] = [];
      let booked = 0;
      // ONE AT A TIME, through the existing path. Sequential rather than
      // parallel on purpose: the capacity check and the insert are not one
      // transaction, so five simultaneous requests for three seats could all
      // read "space free" before any of them writes. In sequence each sees
      // the previous one's booking.
      for (const g of people) {
        const r = await createHostBooking({
          meeting_type_id: mtId,
          invitee_name: g.name,
          invitee_email: g.email,
          starts_at: when,
          payment: paid ? payment : undefined,
          notify,
        });
        if (r.error) missed.push(`${g.name} (${g.email}) — ${r.error}`);
        else booked += 1;
      }

      if (booked === 0) {
        setErr(missed[0] ?? t(locale, 'booking_failed'));
        return;
      }
      router.refresh();
      if (missed.length) {
        // Booked who fitted and SAY who did not. The host is usually standing
        // in front of somebody; half an answer they can act on beats an error
        // that undoes the four bookings that worked.
        setPartial(missed);
        setGuests([]);
        setName('');
        setEmail('');
        setPickedId('');
        return;
      }
      setOpen(false);
      setGuests([]);
      setPickedId('');
      setName('');
      setEmail('');
      setStartsAt('');
      setPartial(null);
    });
  }

  const ready = !!mtId && !!startsAt && allGuests().length > 0;
  /** True when the slot cannot take another person. `seats` null means the
   *  API did not answer — the form then does NOT cap, because refusing on a
   *  number we do not have would block a booking the API would accept. */
  const atCapacity = seats !== null && allGuests().length >= seats.left;
  /** Blocked only while the host has NOT overridden. */
  const full = atCapacity && !overCapacity;
  /** Past the limit, not merely at it — the warning below says this, so the
   *  seat line stays quiet rather than reporting a room that no longer
   *  describes the situation. */
  const over = seats !== null && allGuests().length > seats.left;

  return (
    <>
      {/* Never disabled. With no meeting types this used to be a dead button
          that explained nothing — and "no meeting types in THIS workspace" is
          exactly the thing you cannot guess from a greyed-out control
          (Sjoerd, 2026-09-29: "Button is there... but I cant press it"). It
          opens and says so instead. */}
      <Button
        type="button"
        leading={<Plus className="h-4 w-4" strokeWidth={1.5} />}
        onClick={() => setOpen(true)}
      >
        {t(locale, 'new_booking')}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, 'new_booking')}
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              {t(locale, 'close')}
            </Button>
            {types.length > 0 && (
              <Button type="button" onClick={submit} disabled={!ready || pending}>
                {pending ? t(locale, 'saving') : t(locale, 'create')}
              </Button>
            )}
          </>
        }
      >
        {types.length === 0 ? (
          <div className="space-y-3 text-sm">
            <p>{t(locale, 'no_bookable_types')}</p>
            <Link
              href="/meeting-types/new"
              className="inline-block underline underline-offset-2 hover:text-ink"
            >
              {t(locale, 'new_mt_title')}
            </Link>
          </div>
        ) : (
        <div className="space-y-4">
          <SelectField
            label={t(locale, 'meeting_type')}
            name="meeting_type_id"
            value={mtId}
            onChange={(e) => setMtId(e.target.value)}
            options={types.map((x) => ({
              value: x.id,
              label: `${x.name} · ${x.duration_minutes} min`,
            }))}
          />
          {/* Most people a host books are already known, so the search is
              first; the two fields below are what is submitted either way. */}
          <PersonCombobox
            label={t(locale, 'find_person')}
            search={searchAndRemember}
            value={pickedId}
            onChange={(id, label) => pick(id ? (seen.current.get(id) ?? null) : null, label)}
            onCreate={(typed) => pick(null, typed)}
            createLabel={(typed) => t(locale, 'add_new_person', { name: typed })}
            placeholder={t(locale, 'find_person_placeholder')}
            searchPlaceholder={t(locale, 'find_person_placeholder')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label={t(locale, 'name')}
              name="invitee_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label={t(locale, 'email')}
              name="invitee_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* More than one person into the same slot. Each becomes its own
              booking with its own confirmation and join link — the API makes
              one per person, and that is what a seat IS. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!name.trim() || !email.trim() || full}
              onClick={() => addGuest()}
            >
              {t(locale, 'add_another_person')}
            </Button>
            {/* ONE line about seats, never two. It used to print "3 seats
                left" and "This slot is full." side by side — both true, the
                first about the room and the second about the people picked
                for it, and together they read like the software arguing with
                itself. Past the limit the line goes quiet and the warning
                below carries it. */}
            {seats && !over && (
              <span className="text-xs text-ink-muted">
                {atCapacity
                  ? t(locale, 'seats_filled', {
                      filled: String(seats.taken + allGuests().length),
                      total: String(seats.capacity),
                    })
                  : t(locale, 'seats_left', { left: String(seats.left) })}
              </span>
            )}
            {full && (
              <>
                {/* The route ALLOWS a host to go past capacity (meet.ts: the
                    host booking path makes no capacity check, deliberately —
                    "you are looking at the calendar"). So the dialog offers
                    the same thing, once, on purpose, rather than pretending
                    to a limit the server does not keep. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!name.trim() || !email.trim()}
                  onClick={() => {
                    setOverCapacity(true);
                    addGuest();
                  }}
                >
                  {t(locale, 'add_anyway')}
                </Button>
              </>
            )}
          </div>

          {overCapacity && seats && allGuests().length > seats.left && (
            <p className="text-xs text-amber-700">
              {t(locale, 'over_capacity_warning', {
                people: String(allGuests().length),
                seats: String(seats.left),
              })}
            </p>
          )}

          {guests.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {guests.map((g) => (
                <li
                  key={g.email}
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-surface-sunken px-2 py-1 text-xs"
                >
                  <span className="truncate max-w-[12rem]">
                    {g.name} <span className="text-ink-muted">{g.email}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={t(locale, 'remove')}
                    className="text-ink-muted hover:text-ink"
                    onClick={() => setGuests((xs) => xs.filter((x) => x.email !== g.email))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Booked who fitted, and says plainly who did not — rather than
              rolling back the ones that worked. */}
          {partial && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-medium">{t(locale, 'some_did_not_fit')}</p>
              <ul className="mt-1 list-disc pl-4">
                {partial.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t(locale, 'when')}</label>
            <DateTimeField value={startsAt} onChange={setStartsAt} />
            {/* Your own time is yours to book. The API does not check
                availability for a host-made appointment — you are looking at
                the calendar, and a tool that refused would be arguing. */}
            <p className="mt-1 text-xs text-ink-muted">{t(locale, 'host_booking_time_hint')}</p>
          </div>

          {paid && (
            <div className="rounded-lg border border-line bg-surface-sunken p-3.5">
              <div className="text-sm font-medium">{t(locale, 'payment_of', { price: price! })}</div>
              <div className="mt-2 space-y-1.5">
                {(
                  [
                    ['link', t(locale, 'pay_send_link')],
                    ['invoice', t(locale, 'pay_send_invoice')],
                    ['comp', t(locale, 'pay_on_the_house')],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="payment"
                      checked={payment === value}
                      onChange={() => setPayment(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>{t(locale, 'send_confirmation')}</span>
          </label>

          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
        )}
      </Dialog>
    </>
  );
}
