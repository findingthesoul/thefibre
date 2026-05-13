'use client';

import { useRef, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateChange, type ActionResult } from './actions';

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

const ROLES = [
  { value: '', label: '—' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'champion', label: 'Champion' },
  { value: 'implementer', label: 'Implementer' },
  { value: 'sceptic', label: 'Sceptic' },
  { value: 'bystander', label: 'Bystander' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
];

const STANCES = [
  { value: '', label: '—' },
  { value: 'driving', label: 'Driving' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'ambivalent', label: 'Ambivalent' },
  { value: 'resistant', label: 'Resistant' },
];

const READINESS = [
  { value: '', label: '—' },
  { value: 'not_ready', label: 'Not ready' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'open', label: 'Open' },
  { value: 'ready', label: 'Ready' },
  { value: 'driving', label: 'Driving' },
];

export function ChangeEdit({
  personId,
  initial,
}: {
  personId: string;
  initial: ChangeRow | null;
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
  initial: ChangeRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateChange(personId, {}, fd);
      setState(res);
      if (res.ok) onClose();
    });
  }

  function doSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startSave(async () => {
      const res = await updateChange(personId, {}, fd);
      setState(res);
      if (res.ok) onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit change context"
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
          label="Role in change"
          name="role_in_change"
          defaultValue={initial?.role_in_change ?? ''}
          options={ROLES}
          errors={state.fieldErrors?.role_in_change}
        />
        <SelectField
          label="Stance on change"
          name="stance_on_change"
          defaultValue={initial?.stance_on_change ?? ''}
          options={STANCES}
          errors={state.fieldErrors?.stance_on_change}
        />
        <SelectField
          label="Readiness level"
          name="readiness_level"
          defaultValue={initial?.readiness_level ?? ''}
          options={READINESS}
          errors={state.fieldErrors?.readiness_level}
        />
        <TextField
          label="Leadership style"
          name="leadership_style"
          defaultValue={initial?.leadership_style ?? ''}
          maxLength={200}
          errors={state.fieldErrors?.leadership_style}
        />
        <TextField
          label="Change themes"
          name="change_themes"
          defaultValue={initial?.change_themes?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.change_themes}
        />
        <TextField
          label="Blockers"
          name="blockers"
          defaultValue={initial?.blockers?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.blockers}
        />
        <TextField
          label="Motivators"
          name="motivators"
          defaultValue={initial?.motivators?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.motivators}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Current challenge"
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
                Facilitator notes
                <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  Sensitive
                </span>
              </>
            }
            name="facilitator_notes"
            defaultValue={initial?.facilitator_notes ?? ''}
            maxLength={5000}
            hint="Only you and workspace admins see this. Per brief §5.D2."
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
