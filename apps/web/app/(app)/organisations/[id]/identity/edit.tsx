'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateIdentity, type ActionResult } from './actions';

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

const GOVERNANCE = [
  { value: '', label: '—' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'flat', label: 'Flat' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'holacracy', label: 'Holacracy' },
  { value: 'cooperative', label: 'Cooperative' },
];

const OWNERSHIP = [
  { value: '', label: '—' },
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
  { value: 'family', label: 'Family' },
  { value: 'employee', label: 'Employee' },
  { value: 'state', label: 'State' },
  { value: 'ngo', label: 'NGO' },
];

const DECISION_STYLE = [
  { value: '', label: '—' },
  { value: 'top_down', label: 'Top-down' },
  { value: 'consultative', label: 'Consultative' },
  { value: 'consensus', label: 'Consensus' },
  { value: 'delegated', label: 'Delegated' },
];

const MATURITY = [
  { value: '', label: '—' },
  { value: 'startup', label: 'Startup' },
  { value: 'growth', label: 'Growth' },
  { value: 'established', label: 'Established' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'transitioning', label: 'Transitioning' },
];

export function IdentityEdit({
  orgId,
  initial,
}: {
  orgId: string;
  initial: IdentityRow | null;
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
  initial: IdentityRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
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

  function doSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
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
      title="Edit identity"
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
          label="Governance model"
          name="governance_model"
          defaultValue={initial?.governance_model ?? ''}
          options={GOVERNANCE}
          errors={state.fieldErrors?.governance_model}
        />
        <TextField
          label="Stated values"
          name="stated_values"
          defaultValue={(initial?.stated_values ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.stated_values}
        />
        <SelectField
          label="Ownership type"
          name="ownership_type"
          defaultValue={initial?.ownership_type ?? ''}
          options={OWNERSHIP}
          errors={state.fieldErrors?.ownership_type}
        />
        <TextField
          label="Cultural descriptors"
          name="cultural_descriptors"
          defaultValue={(initial?.cultural_descriptors ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.cultural_descriptors}
        />
        <SelectField
          label="Decision-making style"
          name="decision_making_style"
          defaultValue={initial?.decision_making_style ?? ''}
          options={DECISION_STYLE}
          errors={state.fieldErrors?.decision_making_style}
        />
        <TextField
          label="Languages of operation"
          name="languages_of_operation"
          defaultValue={(initial?.languages_of_operation ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.languages_of_operation}
        />
        <SelectField
          label="Maturity stage"
          name="maturity_stage"
          defaultValue={initial?.maturity_stage ?? ''}
          options={MATURITY}
          errors={state.fieldErrors?.maturity_stage}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Mission statement"
            name="mission_statement"
            defaultValue={initial?.mission_statement ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.mission_statement}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Vision statement"
            name="vision_statement"
            defaultValue={initial?.vision_statement ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.vision_statement}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Notes"
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
