'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateRelationship, type ActionResult } from './actions';

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

const SOURCES = [
  { value: '', label: '—' },
  { value: 'event_attendee', label: 'Event attendee' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_outreach', label: 'Cold outreach' },
  { value: 'client_contact', label: 'Client contact' },
  { value: 'inbound', label: 'Inbound' },
];

const STRENGTHS = [
  { value: '', label: '—' },
  { value: 'weak', label: 'Weak' },
  { value: 'warm', label: 'Warm' },
  { value: 'strong', label: 'Strong' },
  { value: 'advocate', label: 'Advocate' },
];

const COMM_PREFS = ['', 'email', 'phone', 'linkedin', 'in_person'].map((v) => ({
  value: v,
  label: v ? v.replace('_', ' ') : '—',
}));

const YES_NO = [
  { value: '', label: '—' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function RelationshipEdit({
  personId,
  initial,
}: {
  personId: string;
  initial: RelationshipRow | null;
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
  initial: RelationshipRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
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

  function doSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
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
      title="Edit relationship context — Fibre Sales"
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
        <SelectField
          label="Source"
          name="source"
          defaultValue={initial?.source ?? ''}
          options={SOURCES}
          errors={state.fieldErrors?.source}
        />
        <TextField
          label="Source detail"
          name="source_detail"
          maxLength={500}
          defaultValue={initial?.source_detail ?? ''}
          errors={state.fieldErrors?.source_detail}
        />
        <TextField
          label="Introduced by"
          name="introduced_by"
          placeholder="Person UUID, optional"
          defaultValue={initial?.introduced_by ?? ''}
          errors={state.fieldErrors?.introduced_by}
        />
        <SelectField
          label="Relationship strength"
          name="relationship_strength"
          defaultValue={initial?.relationship_strength ?? ''}
          options={STRENGTHS}
          errors={state.fieldErrors?.relationship_strength}
        />
        <SelectField
          label="Communication preference"
          name="communication_preference"
          defaultValue={initial?.communication_preference ?? ''}
          options={COMM_PREFS}
          errors={state.fieldErrors?.communication_preference}
        />
        <TextField
          label="Best time to reach"
          name="best_time_to_reach"
          maxLength={200}
          placeholder="Tuesday afternoons"
          defaultValue={initial?.best_time_to_reach ?? ''}
          errors={state.fieldErrors?.best_time_to_reach}
        />
        <SelectField
          label="Key contact"
          name="is_key_contact"
          defaultValue={
            initial?.is_key_contact === true
              ? 'true'
              : initial?.is_key_contact === false
                ? 'false'
                : ''
          }
          options={YES_NO}
          errors={state.fieldErrors?.is_key_contact}
        />
        <SelectField
          label="Ambassador"
          name="is_ambassador"
          defaultValue={
            initial?.is_ambassador === true
              ? 'true'
              : initial?.is_ambassador === false
                ? 'false'
                : ''
          }
          options={YES_NO}
          errors={state.fieldErrors?.is_ambassador}
        />
        <TextField
          label="First contact at"
          name="first_contact_at"
          type="datetime-local"
          defaultValue={dtDefault}
          errors={state.fieldErrors?.first_contact_at}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="First contact notes"
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
