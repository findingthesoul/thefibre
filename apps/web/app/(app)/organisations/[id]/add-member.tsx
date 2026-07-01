'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { addMember, type ActionResult } from './member-actions';

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const EMPLOYMENT_TYPES = [
  { value: '', label: '—' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'interim', label: 'Interim' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'board', label: 'Board' },
  { value: 'volunteer', label: 'Volunteer' },
];

const INFLUENCE = [
  { value: '', label: '—' },
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
  { value: 'both', label: 'Both' },
];

export function AddMemberButton({ orgId, people }: { orgId: string; people: PersonOption[] }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addMember(orgId, {}, fd);
      setState(res);
      if (res.ok) {
        router.refresh();
        setOpen(false);
        setState({});
      }
    });
  }

  function triggerSubmit() {
    formRef.current?.requestSubmit();
  }

  const personOptions = [
    { value: '', label: '— Select person —' },
    ...people.map((p) => ({
      value: p.id,
      label:
        [p.first_name, p.last_name].filter(Boolean).join(' ') ||
        p.email ||
        p.id.slice(0, 8),
    })),
  ];

  return (
    <>
      <Button
        size="sm"
        leading={<UserPlus size={14} strokeWidth={1.75} />}
        onClick={() => setOpen(true)}
      >
        Add member
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Add member"
        description="Link a person to this organisation with their role and dates."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={triggerSubmit} disabled={pending}>
              {pending ? 'Adding…' : 'Add member'}
            </Button>
          </>
        }
      >
        <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <SelectField
              label="Person"
              name="person_id"
              required
              options={personOptions}
              errors={state.fieldErrors?.person_id}
            />
          </div>
          <TextField label="Title" name="title" placeholder="Head of Programmes" />
          <TextField label="Department" name="department" />
          <SelectField label="Employment type" name="employment_type" options={EMPLOYMENT_TYPES} />
          <SelectField label="Influence" name="influence_level" options={INFLUENCE} />
          <DateField label="Started" name="started_at" />

          <fieldset className="md:col-span-2 mt-2 space-y-2 text-sm">
            <Checkbox name="is_primary" label="Primary contact for this org" />
            <Checkbox name="is_decision_maker" label="Decision maker" />
            <Checkbox name="is_budget_holder" label="Budget holder" />
            <Checkbox name="is_champion" label="Champion" />
          </fieldset>

          {state.error && (
            <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
              {state.error}
            </div>
          )}
        </form>
      </Dialog>
    </>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" name={name} className="rounded border-line" />
      <span>{label}</span>
    </label>
  );
}
