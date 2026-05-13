'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { updateProfessional, type ActionResult } from './actions';

export type ProfessionalRow = {
  current_title: string | null;
  current_department: string | null;
  seniority_level: string | null;
  sector: string | null;
  expertise_areas: string[] | null;
  industries_worked_in: string[] | null;
  years_of_experience: number | null;
  career_stage: string | null;
  is_independent: boolean | null;
  certifications: string[] | null;
  spoken_at_events: string[] | null;
};

const SENIORITY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'executive', label: 'Executive' },
  { value: 'board', label: 'Board' },
];

const CAREER_STAGE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'early', label: 'Early' },
  { value: 'established', label: 'Established' },
  { value: 'senior', label: 'Senior' },
  { value: 'transitioning', label: 'Transitioning' },
  { value: 'portfolio', label: 'Portfolio' },
];

const BOOL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function ProfessionalEdit({
  personId,
  initial,
}: {
  personId: string;
  initial: ProfessionalRow | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leading={<Pencil size={14} strokeWidth={1.75} />}
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
      <EditDialog
        open={open}
        onClose={() => setOpen(false)}
        personId={personId}
        initial={initial}
      />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  personId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  initial: ProfessionalRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  const row: ProfessionalRow = initial ?? {
    current_title: null,
    current_department: null,
    seniority_level: null,
    sector: null,
    expertise_areas: null,
    industries_worked_in: null,
    years_of_experience: null,
    career_stage: null,
    is_independent: null,
    certifications: null,
    spoken_at_events: null,
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateProfessional(personId, {}, fd);
      setState(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  function doSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startSave(async () => {
      const res = await updateProfessional(personId, {}, fd);
      setState(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit professional profile"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={doSave} disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <TextField
          label="Current title"
          name="current_title"
          maxLength={200}
          defaultValue={row.current_title ?? ''}
          errors={state.fieldErrors?.current_title}
        />
        <TextField
          label="Current department"
          name="current_department"
          maxLength={200}
          defaultValue={row.current_department ?? ''}
          errors={state.fieldErrors?.current_department}
        />
        <SelectField
          label="Seniority level"
          name="seniority_level"
          defaultValue={row.seniority_level ?? ''}
          options={SENIORITY_OPTIONS}
          errors={state.fieldErrors?.seniority_level}
        />
        <TextField
          label="Sector"
          name="sector"
          maxLength={200}
          defaultValue={row.sector ?? ''}
          errors={state.fieldErrors?.sector}
        />
        <TextField
          label="Expertise areas"
          name="expertise_areas"
          defaultValue={(row.expertise_areas ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.expertise_areas}
        />
        <TextField
          label="Industries worked in"
          name="industries_worked_in"
          defaultValue={(row.industries_worked_in ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.industries_worked_in}
        />
        <TextField
          label="Years of experience"
          name="years_of_experience"
          type="number"
          min={0}
          max={80}
          defaultValue={row.years_of_experience ?? ''}
          errors={state.fieldErrors?.years_of_experience}
        />
        <SelectField
          label="Career stage"
          name="career_stage"
          defaultValue={row.career_stage ?? ''}
          options={CAREER_STAGE_OPTIONS}
          errors={state.fieldErrors?.career_stage}
        />
        <SelectField
          label="Independent"
          name="is_independent"
          defaultValue={
            row.is_independent === null || row.is_independent === undefined
              ? ''
              : row.is_independent
                ? 'true'
                : 'false'
          }
          options={BOOL_OPTIONS}
          errors={state.fieldErrors?.is_independent}
        />
        <TextField
          label="Certifications"
          name="certifications"
          defaultValue={(row.certifications ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.certifications}
        />
        <TextField
          label="Spoken at events"
          name="spoken_at_events"
          defaultValue={(row.spoken_at_events ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.spoken_at_events}
        />

        {state.error && (
          <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
            {state.error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
