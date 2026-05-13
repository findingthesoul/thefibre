'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { updatePerson, deletePerson, type ActionResult } from '../actions';

export type EditablePerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  pronouns: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

export function ContactActions({ person }: { person: EditablePerson }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  function onDelete() {
    startDelete(async () => {
      await deletePerson(person.id);
      // redirect handled in the action; nothing to do here.
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leading={<Pencil size={14} strokeWidth={1.75} />}
        onClick={() => setEditOpen(true)}
      >
        Edit
      </Button>
      <Button
        variant="danger"
        size="sm"
        leading={<Trash2 size={14} strokeWidth={1.75} />}
        onClick={() => setConfirmOpen(true)}
      >
        Delete
      </Button>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} person={person} />
      <ConfirmDialog
        open={confirmOpen}
        title="Delete contact"
        message={`Soft-delete ${person.first_name ?? ''} ${person.last_name ?? ''}? Personal data stays in the database (deleted_at flag) — only a GDPR erasure removes it.`}
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onDelete}
      />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  person,
}: {
  open: boolean;
  onClose: () => void;
  person: EditablePerson;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updatePerson(person.id, {}, fd);
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
      const res = await updatePerson(person.id, {}, fd);
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
      title="Edit contact"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={doSave} disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="First name" name="first_name" defaultValue={person.first_name ?? ''} required errors={state.fieldErrors?.first_name} />
        <TextField label="Last name" name="last_name" defaultValue={person.last_name ?? ''} required errors={state.fieldErrors?.last_name} />
        <TextField label="Preferred name" name="preferred_name" defaultValue={person.preferred_name ?? ''} errors={state.fieldErrors?.preferred_name} />
        <TextField label="Pronouns" name="pronouns" defaultValue={person.pronouns ?? ''} placeholder="she/her, they/them, …" errors={state.fieldErrors?.pronouns} />
        <TextField label="Email" name="email" type="email" defaultValue={person.email ?? ''} required errors={state.fieldErrors?.email} />
        <TextField label="Phone" name="phone" defaultValue={person.phone ?? ''} errors={state.fieldErrors?.phone} />
        <TextField label="LinkedIn" name="linkedin_url" defaultValue={person.linkedin_url ?? ''} placeholder="linkedin.com/in/…" errors={state.fieldErrors?.linkedin_url} />
        <TextField label="City" name="city" defaultValue={person.city ?? ''} errors={state.fieldErrors?.city} />
        <TextField label="Region" name="region" defaultValue={person.region ?? ''} errors={state.fieldErrors?.region} />
        <TextField
          label="Country (ISO 2-letter)"
          name="country"
          maxLength={2}
          defaultValue={person.country ?? ''}
          placeholder="NL"
          hint="Two letters or leave blank"
          errors={state.fieldErrors?.country}
        />

        {state.error && (
          <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
            {state.error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
