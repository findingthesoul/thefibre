'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { updateProfessional, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

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

const seniorityOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'junior', label: t(locale, 'seniority_junior') },
  { value: 'mid', label: t(locale, 'seniority_mid') },
  { value: 'senior', label: t(locale, 'seniority_senior') },
  { value: 'lead', label: t(locale, 'seniority_lead') },
  { value: 'executive', label: t(locale, 'seniority_executive') },
  { value: 'board', label: t(locale, 'seniority_board') },
];

const careerStageOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'early', label: t(locale, 'career_early') },
  { value: 'established', label: t(locale, 'career_established') },
  { value: 'senior', label: t(locale, 'career_senior') },
  { value: 'transitioning', label: t(locale, 'career_transitioning') },
  { value: 'portfolio', label: t(locale, 'career_portfolio') },
];

const boolOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'true', label: t(locale, 'yes') },
  { value: 'false', label: t(locale, 'no') },
];

export function ProfessionalEdit({
  personId,
  initial,
  locale,
}: {
  personId: string;
  initial: ProfessionalRow | null;
  locale: Locale;
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
        {t(locale, 'edit')}
      </Button>
      <EditDialog
        open={open}
        onClose={() => setOpen(false)}
        personId={personId}
        initial={initial}
        locale={locale}
      />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  personId,
  initial,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  initial: ProfessionalRow | null;
  locale: Locale;
}) {
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, 'edit_professional_profile')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="professional-profile-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form
        id="professional-profile-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <TextField
          label={t(locale, 'current_title')}
          name="current_title"
          maxLength={200}
          defaultValue={row.current_title ?? ''}
          errors={state.fieldErrors?.current_title}
        />
        <TextField
          label={t(locale, 'current_department')}
          name="current_department"
          maxLength={200}
          defaultValue={row.current_department ?? ''}
          errors={state.fieldErrors?.current_department}
        />
        <SelectField
          label={t(locale, 'seniority_level')}
          name="seniority_level"
          defaultValue={row.seniority_level ?? ''}
          options={seniorityOptions(locale)}
          errors={state.fieldErrors?.seniority_level}
        />
        <TextField
          label={t(locale, 'sector')}
          name="sector"
          maxLength={200}
          defaultValue={row.sector ?? ''}
          errors={state.fieldErrors?.sector}
        />
        <TextField
          label={t(locale, 'expertise_areas')}
          name="expertise_areas"
          defaultValue={(row.expertise_areas ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.expertise_areas}
        />
        <TextField
          label={t(locale, 'industries_worked_in')}
          name="industries_worked_in"
          defaultValue={(row.industries_worked_in ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.industries_worked_in}
        />
        <TextField
          label={t(locale, 'years_of_experience')}
          name="years_of_experience"
          type="number"
          min={0}
          max={80}
          defaultValue={row.years_of_experience ?? ''}
          errors={state.fieldErrors?.years_of_experience}
        />
        <SelectField
          label={t(locale, 'career_stage')}
          name="career_stage"
          defaultValue={row.career_stage ?? ''}
          options={careerStageOptions(locale)}
          errors={state.fieldErrors?.career_stage}
        />
        <SelectField
          label={t(locale, 'independent')}
          name="is_independent"
          defaultValue={
            row.is_independent === null || row.is_independent === undefined
              ? ''
              : row.is_independent
                ? 'true'
                : 'false'
          }
          options={boolOptions(locale)}
          errors={state.fieldErrors?.is_independent}
        />
        <TextField
          label={t(locale, 'certifications')}
          name="certifications"
          defaultValue={(row.certifications ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.certifications}
        />
        <TextField
          label={t(locale, 'spoken_at_events')}
          name="spoken_at_events"
          defaultValue={(row.spoken_at_events ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
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
