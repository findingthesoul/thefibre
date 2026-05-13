'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateOrgRelationship, type ActionResult } from './actions';

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

const STAGES = [
  { value: '', label: '—' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'active_client', label: 'Active client' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'lost', label: 'Lost' },
];

const HEALTH = [
  { value: '', label: '—' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'lost', label: 'Lost' },
  { value: 'never_converted', label: 'Never converted' },
];

const ENGAGEMENT = [
  { value: '', label: '—' },
  { value: 'facilitation', label: 'Facilitation' },
  { value: 'learning', label: 'Learning' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'mixed', label: 'Mixed' },
];

export function OrgRelationshipEdit({
  orgId,
  initial,
}: {
  orgId: string;
  initial: OrgRelationshipRow | null;
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
        orgId={orgId}
        initial={initial}
      />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  orgId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  initial: OrgRelationshipRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
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

  function doSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
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
      title="Edit commercial relationship"
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
          label="Relationship stage"
          name="relationship_stage"
          defaultValue={initial?.relationship_stage ?? ''}
          options={STAGES}
          errors={state.fieldErrors?.relationship_stage}
        />
        <SelectField
          label="Health status"
          name="health_status"
          defaultValue={initial?.health_status ?? ''}
          options={HEALTH}
          errors={state.fieldErrors?.health_status}
        />
        <SelectField
          label="Engagement type"
          name="engagement_type"
          defaultValue={initial?.engagement_type ?? ''}
          options={ENGAGEMENT}
          errors={state.fieldErrors?.engagement_type}
        />
        <TextField
          label="Total participants reached"
          name="total_participants_reached"
          type="number"
          min={0}
          defaultValue={initial?.total_participants_reached ?? ''}
          errors={state.fieldErrors?.total_participants_reached}
        />
        <TextField
          label="Touchpoints count"
          name="touchpoints_count"
          type="number"
          min={0}
          defaultValue={initial?.touchpoints_count ?? ''}
          errors={state.fieldErrors?.touchpoints_count}
        />
        <TextField
          label="Last touchpoint at"
          name="last_touchpoint_at"
          type="date"
          defaultValue={initial?.last_touchpoint_at ?? ''}
          errors={state.fieldErrors?.last_touchpoint_at}
        />
        <TextField
          label="Next planned contact"
          name="next_planned_contact"
          type="date"
          defaultValue={initial?.next_planned_contact ?? ''}
          errors={state.fieldErrors?.next_planned_contact}
        />
        <TextField
          label="Programmes completed"
          name="programmes_completed"
          defaultValue={(initial?.programmes_completed ?? []).join(', ')}
          hint="Comma-separated programme names"
          errors={state.fieldErrors?.programmes_completed}
        />
        <TextField
          label="Primary owner"
          name="primary_owner"
          defaultValue={initial?.primary_owner ?? ''}
          placeholder="Owner user UUID, optional"
          errors={state.fieldErrors?.primary_owner}
        />
        <TextField
          label="Secondary owner"
          name="secondary_owner"
          defaultValue={initial?.secondary_owner ?? ''}
          placeholder="Secondary owner user UUID, optional"
          errors={state.fieldErrors?.secondary_owner}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Next opportunity"
            name="next_opportunity"
            defaultValue={initial?.next_opportunity ?? ''}
            maxLength={1000}
            errors={state.fieldErrors?.next_opportunity}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Relationship history"
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
