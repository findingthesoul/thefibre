'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganisation } from '../actions';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { t, type Locale } from '@/lib/i18n-ui';

const orgTypeOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'private', label: t(locale, 'org_type_private') },
  { value: 'public', label: t(locale, 'org_type_public') },
  { value: 'ngo', label: t(locale, 'org_type_ngo') },
  { value: 'cooperative', label: t(locale, 'org_type_cooperative') },
  { value: 'government', label: t(locale, 'org_type_government') },
  { value: 'education', label: t(locale, 'org_type_education') },
];

export function NewOrgForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(createOrganisation, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <TextField label={t(locale, 'name')} name="name" required errors={state.fieldErrors?.name} />
      <TextField label={t(locale, 'domain')} name="domain" placeholder="example.org" errors={state.fieldErrors?.domain} />
      <TextField label={t(locale, 'country_iso')} name="country" placeholder="NL" maxLength={2} errors={state.fieldErrors?.country} />
      <TextField label={t(locale, 'sector')} name="sector" placeholder={t(locale, 'sector_ph')} errors={state.fieldErrors?.sector} />
      <SelectField label={t(locale, 'type')} name="org_type" options={orgTypeOptions(locale)} errors={state.fieldErrors?.org_type} />

      {state.error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          {state.error}
        </div>
      )}

      <Submit locale={locale} />
    </form>
  );
}

function Submit({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t(locale, 'saving') : t(locale, 'add_organisation')}
    </Button>
  );
}
