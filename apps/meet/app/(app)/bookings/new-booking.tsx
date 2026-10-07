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

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PersonCombobox, type PersonOption } from '@thefibre/shared/ui/person-combobox';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { t, type Locale } from '@/lib/i18n-ui';
import { createHostBooking } from './actions';
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

  function submit() {
    setErr(null);
    startTransition(async () => {
      const r = await createHostBooking({
        meeting_type_id: mtId,
        invitee_name: name.trim(),
        invitee_email: email.trim(),
        starts_at: new Date(startsAt).toISOString(),
        payment: paid ? payment : undefined,
        notify,
      });
      if (r.error) {
        setErr(r.error);
        return;
      }
      setOpen(false);
      setPickedId('');
      setName('');
      setEmail('');
      setStartsAt('');
      router.refresh();
    });
  }

  const ready = !!mtId && name.trim() && email.trim() && startsAt;

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
