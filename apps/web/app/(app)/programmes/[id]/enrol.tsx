'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/field';
import { PersonCombobox } from '@/components/ui/person-combobox';
import { enrolPerson, type ActionResult } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const statusOptions = (locale: Locale) => [
  { value: 'invited', label: t(locale, 'status_invited') },
  { value: 'enrolled', label: t(locale, 'status_enrolled') },
  { value: 'active', label: t(locale, 'consent_active') },
];

export function EnrolButton({
  programmeId,
  people,
  locale,
}: {
  programmeId: string;
  people: PersonOption[];
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult>({});
  const [personId, setPersonId] = useState('');
  const [status, setStatus] = useState('invited');

  function doEnrol() {
    if (!personId) {
      setState({ error: t(locale, 'pick_a_person') });
      return;
    }
    start(async () => {
      const res = await enrolPerson(programmeId, personId, status);
      setState(res);
      if (res.ok) {
        router.refresh();
        setOpen(false);
        setPersonId('');
        setStatus('invited');
        setState({});
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        leading={<UserPlus size={14} strokeWidth={1.75} />}
        onClick={() => setOpen(true)}
      >
        {t(locale, 'enrol_person')}
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t(locale, 'enrol_a_person')}
        description={t(locale, 'enrol_blurb')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t(locale, 'cancel')}
            </Button>
            <Button onClick={doEnrol} disabled={pending}>
              {pending ? t(locale, 'enrolling') : t(locale, 'enrol')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <PersonCombobox label={t(locale, 'person')} name="person_id" required people={people} value={personId} onChange={setPersonId} />
          <SelectField label={t(locale, 'initial_status')} name="status" options={statusOptions(locale)} value={status} onChange={(e) => setStatus(e.target.value)} />
          {state.error && (
            <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">{state.error}</div>
          )}
        </div>
      </Dialog>
    </>
  );
}
