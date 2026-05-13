'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { updateOrganisation, deleteOrganisation, type ActionResult } from '../actions';

export type EditableOrg = {
  id: string;
  name: string;
  legal_name: string | null;
  domain: string | null;
  website: string | null;
  linkedin_url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  org_type: string | null;
  size_band: string | null;
};

const ORG_TYPES = [
  { value: '', label: '—' },
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
  { value: 'ngo', label: 'NGO' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'government', label: 'Government' },
  { value: 'education', label: 'Education' },
];

const SIZE_BANDS = [
  { value: '', label: '—' },
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1000' },
  { value: '1000+', label: '1000+' },
];

export function OrgActions({ org }: { org: EditableOrg }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

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

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} org={org} />
      <ConfirmDialog
        open={confirmOpen}
        title="Delete organisation"
        message={`Soft-delete ${org.name}? Records stay in the database (deleted_at flag) — only a GDPR erasure removes them.`}
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => startDelete(async () => { await deleteOrganisation(org.id); })}
      />
    </>
  );
}

function EditDialog({
  open,
  onClose,
  org,
}: {
  open: boolean;
  onClose: () => void;
  org: EditableOrg;
}) {
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await updateOrganisation(org.id, {}, fd);
      setState(res);
      if (res.ok) onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit organisation"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button form="edit-org-form" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="edit-org-form" onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Name" name="name" defaultValue={org.name} required errors={state.fieldErrors?.name} />
        <TextField label="Legal name" name="legal_name" defaultValue={org.legal_name ?? ''} />
        <TextField label="Domain" name="domain" defaultValue={org.domain ?? ''} placeholder="example.org" />
        <TextField label="Website" name="website" type="url" defaultValue={org.website ?? ''} placeholder="https://…" />
        <TextField label="LinkedIn" name="linkedin_url" defaultValue={org.linkedin_url ?? ''} placeholder="https://linkedin.com/company/…" />
        <TextField label="Sector" name="sector" defaultValue={org.sector ?? ''} />
        <TextField label="Industry" name="industry" defaultValue={org.industry ?? ''} />
        <SelectField label="Type" name="org_type" defaultValue={org.org_type ?? ''} options={ORG_TYPES} />
        <SelectField label="Size" name="size_band" defaultValue={org.size_band ?? ''} options={SIZE_BANDS} />
        <TextField label="City" name="city" defaultValue={org.city ?? ''} />
        <TextField label="Region" name="region" defaultValue={org.region ?? ''} />
        <TextField label="Country (ISO 2)" name="country" maxLength={2} defaultValue={org.country ?? ''} placeholder="NL" />

        {state.error && (
          <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
            {state.error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
