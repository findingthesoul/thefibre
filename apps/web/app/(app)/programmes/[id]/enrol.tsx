'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/field';
import { enrolPerson, type ActionResult } from '../actions';

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const STATUSES = [
  { value: 'invited', label: 'Invited' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'active', label: 'Active' },
];

export function EnrolButton({ programmeId, people }: { programmeId: string; people: PersonOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult>({});
  const [personId, setPersonId] = useState('');
  const [status, setStatus] = useState('invited');

  const options = [
    { value: '', label: '— Select person —' },
    ...people.map((p) => ({
      value: p.id,
      label:
        [p.first_name, p.last_name].filter(Boolean).join(' ') ||
        p.email ||
        p.id.slice(0, 8),
    })),
  ];

  function doEnrol() {
    if (!personId) {
      setState({ error: 'Pick a person.' });
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
        Enrol person
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Enrol a person"
        description="Adds an enrolment record. The person can be moved through invited → enrolled → active → completed."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={doEnrol} disabled={pending}>{pending ? 'Enrolling…' : 'Enrol'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField label="Person" name="person_id" required options={options} value={personId} onChange={(e) => setPersonId(e.target.value)} />
          <SelectField label="Initial status" name="status" options={STATUSES} value={status} onChange={(e) => setStatus(e.target.value)} />
          {state.error && (
            <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">{state.error}</div>
          )}
        </div>
      </Dialog>
    </>
  );
}
