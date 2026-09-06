'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { CountryCombobox } from '@/components/ui/country-combobox';
import { updateOrganisation, deleteOrganisation, type ActionResult } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type EditableOrg = {
  id: string;
  name: string;
  legal_name: string | null;
  domain: string | null;
  website: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  org_type: string | null;
  size_band: string | null;
};

const orgTypeOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'private', label: t(locale, 'org_type_private') },
  { value: 'public', label: t(locale, 'org_type_public') },
  { value: 'ngo', label: t(locale, 'org_type_ngo') },
  { value: 'cooperative', label: t(locale, 'org_type_cooperative') },
  { value: 'government', label: t(locale, 'org_type_government') },
  { value: 'education', label: t(locale, 'org_type_education') },
];

const SIZE_BANDS = [
  { value: '', label: '—' },
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1000' },
  { value: '1000+', label: '1000+' },
];

export function OrgActions({ org, locale }: { org: EditableOrg; locale: Locale }) {
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
        {t(locale, 'edit')}
      </Button>
      <Button
        variant="danger"
        size="sm"
        leading={<Trash2 size={14} strokeWidth={1.75} />}
        onClick={() => setConfirmOpen(true)}
      >
        {t(locale, 'delete')}
      </Button>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} org={org} locale={locale} />
      <ConfirmDialog
        open={confirmOpen}
        title={t(locale, 'delete_organisation')}
        message={t(locale, 'delete_organisation_msg', { name: org.name })}
        confirmLabel={t(locale, 'delete')}
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
  locale,
}: {
  open: boolean;
  onClose: () => void;
  org: EditableOrg;
  locale: Locale;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startSave] = useTransition();
  const [state, setState] = useState<ActionResult>({});

  function doSave() {
    if (!formRef.current) {
      console.error('[edit-org] formRef is null');
      return;
    }
    const fd = new FormData(formRef.current);
    startSave(async () => {
      const res = await updateOrganisation(org.id, {}, fd);
      setState(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    doSave();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, 'edit_organisation')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="org-edit-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form id="org-edit-form" ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label={t(locale, 'name')} name="name" defaultValue={org.name} required errors={state.fieldErrors?.name} />
        <TextField label={t(locale, 'legal_name')} name="legal_name" defaultValue={org.legal_name ?? ''} errors={state.fieldErrors?.legal_name} />
        <TextField label={t(locale, 'domain')} name="domain" defaultValue={org.domain ?? ''} placeholder="example.org" errors={state.fieldErrors?.domain} />
        <TextField label={t(locale, 'website')} name="website" defaultValue={org.website ?? ''} placeholder="thefibre.app or https://thefibre.app" errors={state.fieldErrors?.website} />
        <TextField label="LinkedIn" name="linkedin_url" defaultValue={org.linkedin_url ?? ''} placeholder="linkedin.com/company/…" errors={state.fieldErrors?.linkedin_url} />
        <div className="md:col-span-2">
          <TextField
            label={t(locale, 'logo_url')}
            name="logo_url"
            defaultValue={org.logo_url ?? ''}
            placeholder="https://… (PNG, JPG, SVG)"
            hint={t(locale, 'logo_url_hint')}
            errors={state.fieldErrors?.logo_url}
          />
        </div>
        <TextField label={t(locale, 'sector')} name="sector" defaultValue={org.sector ?? ''} errors={state.fieldErrors?.sector} />
        <TextField label={t(locale, 'industry')} name="industry" defaultValue={org.industry ?? ''} errors={state.fieldErrors?.industry} />
        <SelectField label={t(locale, 'type')} name="org_type" defaultValue={org.org_type ?? ''} options={orgTypeOptions(locale)} errors={state.fieldErrors?.org_type} />
        <SelectField label={t(locale, 'size')} name="size_band" defaultValue={org.size_band ?? ''} options={SIZE_BANDS} errors={state.fieldErrors?.size_band} />
        <TextField label={t(locale, 'street')} name="street" defaultValue={org.street ?? ''} errors={state.fieldErrors?.street} />
        <TextField label={t(locale, 'postal_code')} name="postal_code" defaultValue={org.postal_code ?? ''} errors={state.fieldErrors?.postal_code} />
        <TextField label={t(locale, 'city')} name="city" defaultValue={org.city ?? ''} errors={state.fieldErrors?.city} />
        <TextField label={t(locale, 'region')} name="region" defaultValue={org.region ?? ''} errors={state.fieldErrors?.region} />
        <CountryCombobox
          label={t(locale, 'country')}
          name="country"
          defaultValue={org.country}
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
