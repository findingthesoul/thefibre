'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateSystemContext, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type SystemContextRow = {
  transformation_stage: string | null;
  active_change_themes: string[] | null;
  structural_tensions: string[] | null;
  strategic_priorities: string | null;
  current_challenges: string | null;
  political_landscape: string | null;
  leadership_stability: string | null;
  change_readiness: string | null;
  previous_interventions: string[] | null;
  lessons_from_previous_work: string | null;
  blockers: string[] | null;
  enablers: string[] | null;
};

const stageOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'pre_awareness', label: t(locale, 'stage_pre_awareness') },
  { value: 'exploring', label: t(locale, 'stage_exploring') },
  { value: 'committed', label: t(locale, 'stage_committed') },
  { value: 'in_programme', label: t(locale, 'stage_in_programme') },
  { value: 'sustaining', label: t(locale, 'stage_sustaining') },
  { value: 'alumni', label: t(locale, 'stage_alumni') },
];

const stabilityOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'stable', label: t(locale, 'stability_stable') },
  { value: 'transitioning', label: t(locale, 'career_transitioning') },
  { value: 'turbulent', label: t(locale, 'stability_turbulent') },
];

const readinessOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'not_ready', label: t(locale, 'readiness_not_ready') },
  { value: 'cautious', label: t(locale, 'readiness_cautious') },
  { value: 'open', label: t(locale, 'readiness_open') },
  { value: 'ready', label: t(locale, 'readiness_ready') },
  { value: 'driving', label: t(locale, 'stance_driving') },
];

export function SystemContextEdit({
  orgId,
  initial,
  locale,
}: {
  orgId: string;
  initial: SystemContextRow | null;
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
        orgId={orgId}
        initial={initial}
        locale={locale}
      />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  orgId,
  initial,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  initial: SystemContextRow | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateSystemContext(orgId, {}, fd);
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
      title={t(locale, 'edit_system_context')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="org-system-context-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form
        id="org-system-context-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <SelectField
          label={t(locale, 'transformation_stage')}
          name="transformation_stage"
          defaultValue={initial?.transformation_stage ?? ''}
          options={stageOptions(locale)}
          errors={state.fieldErrors?.transformation_stage}
        />
        <SelectField
          label={t(locale, 'leadership_stability')}
          name="leadership_stability"
          defaultValue={initial?.leadership_stability ?? ''}
          options={stabilityOptions(locale)}
          errors={state.fieldErrors?.leadership_stability}
        />
        <SelectField
          label={t(locale, 'change_readiness')}
          name="change_readiness"
          defaultValue={initial?.change_readiness ?? ''}
          options={readinessOptions(locale)}
          errors={state.fieldErrors?.change_readiness}
        />
        <TextField
          label={t(locale, 'active_change_themes')}
          name="active_change_themes"
          defaultValue={initial?.active_change_themes?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.active_change_themes}
        />
        <TextField
          label={t(locale, 'structural_tensions')}
          name="structural_tensions"
          defaultValue={initial?.structural_tensions?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.structural_tensions}
        />
        <TextField
          label={t(locale, 'previous_interventions')}
          name="previous_interventions"
          defaultValue={initial?.previous_interventions?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.previous_interventions}
        />
        <TextField
          label={t(locale, 'blockers')}
          name="blockers"
          defaultValue={initial?.blockers?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.blockers}
        />
        <TextField
          label={t(locale, 'enablers')}
          name="enablers"
          defaultValue={initial?.enablers?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.enablers}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'strategic_priorities')}
            name="strategic_priorities"
            defaultValue={initial?.strategic_priorities ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.strategic_priorities}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'current_challenges')}
            name="current_challenges"
            defaultValue={initial?.current_challenges ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.current_challenges}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'lessons_previous_work')}
            name="lessons_from_previous_work"
            defaultValue={initial?.lessons_from_previous_work ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.lessons_from_previous_work}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={
              <>
                {t(locale, 'political_landscape')}
                <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  {t(locale, 'sensitive')}
                </span>
              </>
            }
            name="political_landscape"
            defaultValue={initial?.political_landscape ?? ''}
            maxLength={5000}
            hint={t(locale, 'political_landscape_hint')}
            errors={state.fieldErrors?.political_landscape}
          />
        </div>

        {state.error && (
          <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
            {state.error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
