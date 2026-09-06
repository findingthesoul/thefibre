'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { updateOrgRelationship, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type OrgRelationshipRow = {
  primary_owner: string | null;
  secondary_owner: string | null;
  relationship_stage: string | null;
  health_status: string | null;
  engagement_type: string | null;
  programmes_completed: string[] | null;
  total_participants_reached: number | null;
  touchpoints_count: number | null;
  relationship_history: string | null;
  next_opportunity: string | null;
  last_touchpoint_at: string | null;
  next_planned_contact: string | null;
};

const stageOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'prospect', label: t(locale, 'rel_stage_prospect') },
  { value: 'engaged', label: t(locale, 'rel_stage_engaged') },
  { value: 'active_client', label: t(locale, 'rel_stage_active_client') },
  { value: 'alumni', label: t(locale, 'stage_alumni') },
  { value: 'dormant', label: t(locale, 'rel_stage_dormant') },
  { value: 'lost', label: t(locale, 'rel_stage_lost') },
];

const healthOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'active', label: t(locale, 'consent_active') },
  { value: 'at_risk', label: t(locale, 'health_at_risk') },
  { value: 'dormant', label: t(locale, 'rel_stage_dormant') },
  { value: 'lost', label: t(locale, 'rel_stage_lost') },
  { value: 'never_converted', label: t(locale, 'health_never_converted') },
];

const engagementOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'facilitation', label: t(locale, 'engagement_facilitation') },
  { value: 'learning', label: t(locale, 'engagement_learning') },
  { value: 'advisory', label: t(locale, 'engagement_advisory') },
  { value: 'speaking', label: t(locale, 'engagement_speaking') },
  { value: 'mixed', label: t(locale, 'engagement_mixed') },
];

export function OrgRelationshipEdit({
  orgId,
  initial,
  locale,
}: {
  orgId: string;
  initial: OrgRelationshipRow | null;
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
  initial: OrgRelationshipRow | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateOrgRelationship(orgId, {}, fd);
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
      title={t(locale, 'edit_commercial_relationship')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="org-relationship-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form
        id="org-relationship-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <SelectField
          label={t(locale, 'relationship_stage')}
          name="relationship_stage"
          defaultValue={initial?.relationship_stage ?? ''}
          options={stageOptions(locale)}
          errors={state.fieldErrors?.relationship_stage}
        />
        <SelectField
          label={t(locale, 'health_status')}
          name="health_status"
          defaultValue={initial?.health_status ?? ''}
          options={healthOptions(locale)}
          errors={state.fieldErrors?.health_status}
        />
        <SelectField
          label={t(locale, 'engagement_type')}
          name="engagement_type"
          defaultValue={initial?.engagement_type ?? ''}
          options={engagementOptions(locale)}
          errors={state.fieldErrors?.engagement_type}
        />
        <TextField
          label={t(locale, 'total_participants_reached')}
          name="total_participants_reached"
          type="number"
          min={0}
          defaultValue={initial?.total_participants_reached ?? ''}
          errors={state.fieldErrors?.total_participants_reached}
        />
        <TextField
          label={t(locale, 'touchpoints_count')}
          name="touchpoints_count"
          type="number"
          min={0}
          defaultValue={initial?.touchpoints_count ?? ''}
          errors={state.fieldErrors?.touchpoints_count}
        />
        <DateField
          label={t(locale, 'last_touchpoint')}
          name="last_touchpoint_at"
          defaultValue={initial?.last_touchpoint_at ?? ''}
        />
        <DateField
          label={t(locale, 'next_planned_contact')}
          name="next_planned_contact"
          defaultValue={initial?.next_planned_contact ?? ''}
        />
        <TextField
          label={t(locale, 'programmes_completed')}
          name="programmes_completed"
          defaultValue={(initial?.programmes_completed ?? []).join(', ')}
          hint={t(locale, 'comma_separated')}
          errors={state.fieldErrors?.programmes_completed}
        />
        <TextField
          label={t(locale, 'primary_owner')}
          name="primary_owner"
          defaultValue={initial?.primary_owner ?? ''}
          placeholder={t(locale, 'person_uuid_optional')}
          errors={state.fieldErrors?.primary_owner}
        />
        <TextField
          label={t(locale, 'secondary_owner')}
          name="secondary_owner"
          defaultValue={initial?.secondary_owner ?? ''}
          placeholder={t(locale, 'person_uuid_optional')}
          errors={state.fieldErrors?.secondary_owner}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'next_opportunity')}
            name="next_opportunity"
            defaultValue={initial?.next_opportunity ?? ''}
            maxLength={1000}
            errors={state.fieldErrors?.next_opportunity}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'relationship_history')}
            name="relationship_history"
            defaultValue={initial?.relationship_history ?? ''}
            maxLength={5000}
            errors={state.fieldErrors?.relationship_history}
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
