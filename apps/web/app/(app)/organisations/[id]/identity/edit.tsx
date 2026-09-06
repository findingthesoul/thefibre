'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateIdentity, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type IdentityRow = {
  mission_statement: string | null;
  vision_statement: string | null;
  stated_values: string[] | null;
  cultural_descriptors: string[] | null;
  governance_model: string | null;
  ownership_type: string | null;
  decision_making_style: string | null;
  languages_of_operation: string[] | null;
  maturity_stage: string | null;
  identity_notes: string | null;
};

const governanceOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'hierarchical', label: t(locale, 'gov_hierarchical') },
  { value: 'flat', label: t(locale, 'gov_flat') },
  { value: 'matrix', label: t(locale, 'gov_matrix') },
  { value: 'holacracy', label: t(locale, 'gov_holacracy') },
  { value: 'cooperative', label: t(locale, 'org_type_cooperative') },
];

const ownershipOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'private', label: t(locale, 'org_type_private') },
  { value: 'public', label: t(locale, 'org_type_public') },
  { value: 'family', label: t(locale, 'ownership_family') },
  { value: 'employee', label: t(locale, 'ownership_employee') },
  { value: 'state', label: t(locale, 'ownership_state') },
  { value: 'ngo', label: t(locale, 'org_type_ngo') },
];

const decisionStyleOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'top_down', label: t(locale, 'decision_top_down') },
  { value: 'consultative', label: t(locale, 'decision_consultative') },
  { value: 'consensus', label: t(locale, 'decision_consensus') },
  { value: 'delegated', label: t(locale, 'decision_delegated') },
];

const maturityOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'startup', label: t(locale, 'maturity_startup') },
  { value: 'growth', label: t(locale, 'maturity_growth') },
  { value: 'established', label: t(locale, 'career_established') },
  { value: 'legacy', label: t(locale, 'maturity_legacy') },
  { value: 'transitioning', label: t(locale, 'career_transitioning') },
];

export function IdentityEdit({
  orgId,
  initial,
  locale,
}: {
  orgId: string;
  initial: IdentityRow | null;
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
  initial: IdentityRow | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateIdentity(orgId, {}, fd);
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
      title={t(locale, 'edit_identity')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="org-identity-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form
        id="org-identity-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <SelectField
          label={t(locale, 'governance_model')}
          name="governance_model"
          defaultValue={initial?.governance_model ?? ''}
          options={governanceOptions(locale)}
          errors={state.fieldErrors?.governance_model}
        />
        <TextField
          label={t(locale, 'stated_values')}
          name="stated_values"
          defaultValue={(initial?.stated_values ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.stated_values}
        />
        <SelectField
          label={t(locale, 'ownership_type')}
          name="ownership_type"
          defaultValue={initial?.ownership_type ?? ''}
          options={ownershipOptions(locale)}
          errors={state.fieldErrors?.ownership_type}
        />
        <TextField
          label={t(locale, 'cultural_descriptors')}
          name="cultural_descriptors"
          defaultValue={(initial?.cultural_descriptors ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.cultural_descriptors}
        />
        <SelectField
          label={t(locale, 'decision_making_style')}
          name="decision_making_style"
          defaultValue={initial?.decision_making_style ?? ''}
          options={decisionStyleOptions(locale)}
          errors={state.fieldErrors?.decision_making_style}
        />
        <TextField
          label={t(locale, 'languages_of_operation')}
          name="languages_of_operation"
          defaultValue={(initial?.languages_of_operation ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.languages_of_operation}
        />
        <SelectField
          label={t(locale, 'maturity_stage')}
          name="maturity_stage"
          defaultValue={initial?.maturity_stage ?? ''}
          options={maturityOptions(locale)}
          errors={state.fieldErrors?.maturity_stage}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'mission_statement')}
            name="mission_statement"
            defaultValue={initial?.mission_statement ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.mission_statement}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'vision_statement')}
            name="vision_statement"
            defaultValue={initial?.vision_statement ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.vision_statement}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'notes')}
            name="identity_notes"
            defaultValue={initial?.identity_notes ?? ''}
            maxLength={5000}
            errors={state.fieldErrors?.identity_notes}
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
