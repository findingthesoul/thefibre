'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { updateSystemContext, type ActionResult } from './actions';

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

const STAGES = [
  { value: '', label: '—' },
  { value: 'pre_awareness', label: 'Pre-awareness' },
  { value: 'exploring', label: 'Exploring' },
  { value: 'committed', label: 'Committed' },
  { value: 'in_programme', label: 'In programme' },
  { value: 'sustaining', label: 'Sustaining' },
  { value: 'alumni', label: 'Alumni' },
];

const STABILITY = [
  { value: '', label: '—' },
  { value: 'stable', label: 'Stable' },
  { value: 'transitioning', label: 'Transitioning' },
  { value: 'turbulent', label: 'Turbulent' },
];

const READINESS = [
  { value: '', label: '—' },
  { value: 'not_ready', label: 'Not ready' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'open', label: 'Open' },
  { value: 'ready', label: 'Ready' },
  { value: 'driving', label: 'Driving' },
];

export function SystemContextEdit({
  orgId,
  initial,
}: {
  orgId: string;
  initial: SystemContextRow | null;
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
  initial: SystemContextRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
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

  function doSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
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
      title="Edit system context"
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
          label="Transformation stage"
          name="transformation_stage"
          defaultValue={initial?.transformation_stage ?? ''}
          options={STAGES}
          errors={state.fieldErrors?.transformation_stage}
        />
        <SelectField
          label="Leadership stability"
          name="leadership_stability"
          defaultValue={initial?.leadership_stability ?? ''}
          options={STABILITY}
          errors={state.fieldErrors?.leadership_stability}
        />
        <SelectField
          label="Change readiness"
          name="change_readiness"
          defaultValue={initial?.change_readiness ?? ''}
          options={READINESS}
          errors={state.fieldErrors?.change_readiness}
        />
        <TextField
          label="Active change themes"
          name="active_change_themes"
          defaultValue={initial?.active_change_themes?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.active_change_themes}
        />
        <TextField
          label="Structural tensions"
          name="structural_tensions"
          defaultValue={initial?.structural_tensions?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.structural_tensions}
        />
        <TextField
          label="Previous interventions"
          name="previous_interventions"
          defaultValue={initial?.previous_interventions?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.previous_interventions}
        />
        <TextField
          label="Blockers"
          name="blockers"
          defaultValue={initial?.blockers?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.blockers}
        />
        <TextField
          label="Enablers"
          name="enablers"
          defaultValue={initial?.enablers?.join(', ') ?? ''}
          hint="Comma-separated"
          errors={state.fieldErrors?.enablers}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Strategic priorities"
            name="strategic_priorities"
            defaultValue={initial?.strategic_priorities ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.strategic_priorities}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Current challenges"
            name="current_challenges"
            defaultValue={initial?.current_challenges ?? ''}
            maxLength={2000}
            errors={state.fieldErrors?.current_challenges}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            label="Lessons from previous work"
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
                Political landscape
                <span className="ml-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  Sensitive
                </span>
              </>
            }
            name="political_landscape"
            defaultValue={initial?.political_landscape ?? ''}
            maxLength={5000}
            hint="Workspace admins and the person who wrote it. Per brief §5.D3."
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
