'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { CountryCombobox } from '@/components/ui/country-combobox';
import { updatePerson, deletePerson, type ActionResult } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type EditablePerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  pronouns: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  preferred_language: string | null;
};

export function ContactActions({ person, locale }: { person: EditablePerson; locale: Locale }) {
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

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} person={person} locale={locale} />
      <ConfirmDialog
        open={confirmOpen}
        title={t(locale, 'delete_contact')}
        message={t(locale, 'delete_contact_msg', {
          name: `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim(),
        })}
        confirmLabel={t(locale, 'delete')}
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
  locale,
}: {
  open: boolean;
  onClose: () => void;
  person: EditablePerson;
  locale: Locale;
}) {
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, 'edit_contact')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="contact-identity-form" disabled={pending}>
            {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
          </Button>
        </>
      }
    >
      <form id="contact-identity-form" onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label={t(locale, 'first_name')} name="first_name" defaultValue={person.first_name ?? ''} required errors={state.fieldErrors?.first_name} />
        <TextField label={t(locale, 'last_name')} name="last_name" defaultValue={person.last_name ?? ''} required errors={state.fieldErrors?.last_name} />
        <TextField label={t(locale, 'preferred_name')} name="preferred_name" defaultValue={person.preferred_name ?? ''} errors={state.fieldErrors?.preferred_name} />
        <TextField label={t(locale, 'pronouns')} name="pronouns" defaultValue={person.pronouns ?? ''} placeholder="she/her, they/them, …" errors={state.fieldErrors?.pronouns} />
        <TextField label={t(locale, 'email_label')} name="email" type="email" defaultValue={person.email ?? ''} required errors={state.fieldErrors?.email} />
        <TextField label={t(locale, 'phone')} name="phone" defaultValue={person.phone ?? ''} errors={state.fieldErrors?.phone} />
        <TextField label="LinkedIn" name="linkedin_url" defaultValue={person.linkedin_url ?? ''} placeholder="linkedin.com/in/…" errors={state.fieldErrors?.linkedin_url} />
        <TextField label={t(locale, 'street')} name="street" defaultValue={person.street ?? ''} errors={state.fieldErrors?.street} />
        <TextField label={t(locale, 'postal_code')} name="postal_code" defaultValue={person.postal_code ?? ''} errors={state.fieldErrors?.postal_code} />
        <TextField label={t(locale, 'city')} name="city" defaultValue={person.city ?? ''} errors={state.fieldErrors?.city} />
        <TextField label={t(locale, 'region')} name="region" defaultValue={person.region ?? ''} errors={state.fieldErrors?.region} />
        <CountryCombobox
          label={t(locale, 'country')}
          name="country"
          defaultValue={person.country}
          errors={state.fieldErrors?.country}
        />
        <TextField
          label={t(locale, 'preferred_language')}
          name="preferred_language"
          defaultValue={person.preferred_language ?? ''}
          placeholder="en, nl, fr…"
          hint={t(locale, 'iso_639_hint')}
          maxLength={10}
          errors={state.fieldErrors?.preferred_language}
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
