'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { updateRelationship, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type RelationshipRow = {
  source: string | null;
  source_detail: string | null;
  introduced_by: string | null;
  relationship_strength: string | null;
  communication_preference: string | null;
  best_time_to_reach: string | null;
  is_key_contact: boolean | null;
  is_ambassador: boolean | null;
  first_contact_notes: string | null;
  first_contact_at: string | null;
};

const sourceOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'event_attendee', label: t(locale, 'source_event_attendee') },
  { value: 'referral', label: t(locale, 'source_referral') },
  { value: 'cold_outreach', label: t(locale, 'source_cold_outreach') },
  { value: 'client_contact', label: t(locale, 'source_client_contact') },
  { value: 'inbound', label: t(locale, 'source_inbound') },
];

const strengthOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'weak', label: t(locale, 'strength_weak') },
  { value: 'warm', label: t(locale, 'strength_warm') },
  { value: 'strong', label: t(locale, 'strength_strong') },
  { value: 'advocate', label: t(locale, 'strength_advocate') },
];

const commPrefOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'email', label: t(locale, 'email_label') },
  { value: 'phone', label: t(locale, 'phone') },
  { value: 'linkedin', label: t(locale, 'comm_linkedin') },
  { value: 'in_person', label: t(locale, 'comm_in_person') },
];

const yesNoOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'true', label: t(locale, 'yes') },
  { value: 'false', label: t(locale, 'no') },
];

export function RelationshipEdit({
  personId,
  initial,
  locale,
}: {
  personId: string;
  initial: RelationshipRow | null;
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
  initial: RelationshipRow | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateRelationship(personId, {}, fd);
      setState(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  const dtDefault = initial?.first_contact_at
    ? initial.first_contact_at.slice(0, 16)
    : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, 'edit_relationship_context')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="relationship-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form
        id="relationship-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <SelectField
          label={t(locale, 'source')}
          name="source"
          defaultValue={initial?.source ?? ''}
          options={sourceOptions(locale)}
          errors={state.fieldErrors?.source}
        />
        <TextField
          label={t(locale, 'source_detail')}
          name="source_detail"
          maxLength={500}
          defaultValue={initial?.source_detail ?? ''}
          errors={state.fieldErrors?.source_detail}
        />
        <TextField
          label={t(locale, 'introduced_by')}
          name="introduced_by"
          placeholder={t(locale, 'person_uuid_optional')}
          defaultValue={initial?.introduced_by ?? ''}
          errors={state.fieldErrors?.introduced_by}
        />
        <SelectField
          label={t(locale, 'relationship_strength')}
          name="relationship_strength"
          defaultValue={initial?.relationship_strength ?? ''}
          options={strengthOptions(locale)}
          errors={state.fieldErrors?.relationship_strength}
        />
        <SelectField
          label={t(locale, 'communication_preference')}
          name="communication_preference"
          defaultValue={initial?.communication_preference ?? ''}
          options={commPrefOptions(locale)}
          errors={state.fieldErrors?.communication_preference}
        />
        <TextField
          label={t(locale, 'best_time_to_reach')}
          name="best_time_to_reach"
          maxLength={200}
          placeholder={t(locale, 'best_time_ph')}
          defaultValue={initial?.best_time_to_reach ?? ''}
          errors={state.fieldErrors?.best_time_to_reach}
        />
        <SelectField
          label={t(locale, 'key_contact')}
          name="is_key_contact"
          defaultValue={
            initial?.is_key_contact === true
              ? 'true'
              : initial?.is_key_contact === false
                ? 'false'
                : ''
          }
          options={yesNoOptions(locale)}
          errors={state.fieldErrors?.is_key_contact}
        />
        <SelectField
          label={t(locale, 'ambassador')}
          name="is_ambassador"
          defaultValue={
            initial?.is_ambassador === true
              ? 'true'
              : initial?.is_ambassador === false
                ? 'false'
                : ''
          }
          options={yesNoOptions(locale)}
          errors={state.fieldErrors?.is_ambassador}
        />
        <DateTimeField
          label={t(locale, 'first_contact_at')}
          name="first_contact_at"
          defaultValue={dtDefault}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label={t(locale, 'first_contact_notes')}
            name="first_contact_notes"
            maxLength={2000}
            defaultValue={initial?.first_contact_notes ?? ''}
            errors={state.fieldErrors?.first_contact_notes}
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
