'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateChange, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type ChangeRow = {
  role_in_change: string | null;
  stance_on_change: string | null;
  change_themes: string[] | null;
  leadership_style: string | null;
  blockers: string[] | null;
  motivators: string[] | null;
  current_challenge: string | null;
  facilitator_notes: string | null;
  readiness_level: string | null;
};

const roleOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'sponsor', label: t(locale, 'change_role_sponsor') },
  { value: 'champion', label: t(locale, 'champion') },
  { value: 'implementer', label: t(locale, 'change_role_implementer') },
  { value: 'sceptic', label: t(locale, 'change_role_sceptic') },
  { value: 'bystander', label: t(locale, 'change_role_bystander') },
  { value: 'gatekeeper', label: t(locale, 'change_role_gatekeeper') },
];

const stanceOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'driving', label: t(locale, 'stance_driving') },
  { value: 'supporting', label: t(locale, 'stance_supporting') },
  { value: 'ambivalent', label: t(locale, 'stance_ambivalent') },
  { value: 'resistant', label: t(locale, 'stance_resistant') },
];

const readinessOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'not_ready', label: t(locale, 'readiness_not_ready') },
  { value: 'cautious', label: t(locale, 'readiness_cautious') },
  { value: 'open', label: t(locale, 'readiness_open') },
  { value: 'ready', label: t(locale, 'readiness_ready') },
  { value: 'driving', label: t(locale, 'stance_driving') },
];

export function ChangeEdit({
  personId,
  initial,
  locale,
}: {
  personId: string;
  initial: ChangeRow | null;
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
  initial: ChangeRow | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateChange(personId, {}, fd);
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
      title={t(locale, 'edit_change_context')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="change-context-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form
        id="change-context-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <SelectField
          label={t(locale, 'role_in_change')}
          name="role_in_change"
          defaultValue={initial?.role_in_change ?? ''}
          options={roleOptions(locale)}
          errors={state.fieldErrors?.role_in_change}
        />
        <SelectField
          label={t(locale, 'stance_on_change')}
          name="stance_on_change"
          defaultValue={initial?.stance_on_change ?? ''}
          options={stanceOptions(locale)}
          errors={state.fieldErrors?.stance_on_change}
        />
        <SelectField
          label={t(locale, 'readiness_level')}
          name="readiness_level"
          defaultValue={initial?.readiness_level ?? ''}
          options={readinessOptions(locale)}
          errors={state.fieldErrors?.readiness_level}
        />
        <TextField
          label={t(locale, 'leadership_style')}
          name="leadership_style"
          defaultValue={initial?.leadership_style ?? ''}
          maxLength={200}
          errors={state.fieldErrors?.leadership_style}
        />
        <TextField
          label={t(locale, 'change_themes')}
          name="change_themes"
          defaultValue={initial?.change_themes?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.change_themes}
        />
        <TextField
          label={t(locale, 'blockers')}
          name="blockers"
          defaultValue={initial?.blockers?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.blockers}
        />
        <TextField
          label={t(locale, 'motivators')}
          name="motivators"
          defaultValue={initial?.motivators?.join(', ') ?? ''}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.motivators}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'current_challenge')}
            name="current_challenge"
            defaultValue={initial?.current_challenge ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.current_challenge}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={
              <>
                {t(locale, 'facilitator_notes')}
                <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  {t(locale, 'sensitive')}
                </span>
              </>
            }
            name="facilitator_notes"
            defaultValue={initial?.facilitator_notes ?? ''}
            maxLength={5000}
            hint={t(locale, 'facilitator_notes_hint')}
            errors={state.fieldErrors?.facilitator_notes}
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
