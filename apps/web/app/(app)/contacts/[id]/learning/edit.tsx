'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateLearning, type ActionResult } from './actions';

export type LearningRow = {
  learning_interests: string[] | null;
  prior_programmes: string[] | null;
  learning_style: string | null;
  group_role_tendency: string | null;
  development_goals: string | null;
  post_programme_reflection: string | null;
  open_to_coaching: boolean | null;
  open_to_peer_exchange: boolean | null;
};

const LEARNING_STYLES = [
  { value: '', label: '—' },
  { value: 'visual', label: 'Visual' },
  { value: 'auditory', label: 'Auditory' },
  { value: 'reading', label: 'Reading' },
  { value: 'kinaesthetic', label: 'Kinaesthetic' },
  { value: 'reflective', label: 'Reflective' },
];

const GROUP_ROLES = [
  { value: '', label: '—' },
  { value: 'connector', label: 'Connector' },
  { value: 'challenger', label: 'Challenger' },
  { value: 'synthesiser', label: 'Synthesiser' },
  { value: 'anchor', label: 'Anchor' },
  { value: 'observer', label: 'Observer' },
];

const YES_NO = [
  { value: '', label: '—' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

function boolToSelect(v: boolean | null): string {
  if (v === true) return 'true';
  if (v === false) return 'false';
  return '';
}

export function LearningEdit({
  personId,
  initial,
}: {
  personId: string;
  initial: LearningRow | null;
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
  initial: LearningRow | null;
}) {
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateLearning(personId, {}, fd);
      setState(res);
      if (res.ok) onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit learning profile"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button form="learning-edit-form" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id="learning-edit-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <SelectField
          label="Learning style"
          name="learning_style"
          defaultValue={initial?.learning_style ?? ''}
          options={LEARNING_STYLES}
          errors={state.fieldErrors?.learning_style}
        />
        <SelectField
          label="Group role tendency"
          name="group_role_tendency"
          defaultValue={initial?.group_role_tendency ?? ''}
          options={GROUP_ROLES}
          errors={state.fieldErrors?.group_role_tendency}
        />
        <SelectField
          label="Open to coaching"
          name="open_to_coaching"
          defaultValue={boolToSelect(initial?.open_to_coaching ?? null)}
          options={YES_NO}
          errors={state.fieldErrors?.open_to_coaching}
        />
        <SelectField
          label="Open to peer exchange"
          name="open_to_peer_exchange"
          defaultValue={boolToSelect(initial?.open_to_peer_exchange ?? null)}
          options={YES_NO}
          errors={state.fieldErrors?.open_to_peer_exchange}
        />
        <TextField
          label="Learning interests"
          name="learning_interests"
          defaultValue={(initial?.learning_interests ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.learning_interests}
        />
        <TextField
          label="Prior programmes"
          name="prior_programmes"
          defaultValue={(initial?.prior_programmes ?? []).join(', ')}
          hint="Comma-separated"
          errors={state.fieldErrors?.prior_programmes}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Development goals"
            name="development_goals"
            defaultValue={initial?.development_goals ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.development_goals}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label={
              <>
                Post-programme reflection
                <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  Participant-owned
                </span>
              </>
            }
            name="post_programme_reflection"
            defaultValue={initial?.post_programme_reflection ?? ''}
            maxLength={5000}
            hint="Per brief §5.D2 the participant writes this themselves. Don't paste observations here."
            errors={state.fieldErrors?.post_programme_reflection}
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
