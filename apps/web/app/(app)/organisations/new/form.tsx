'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganisation } from '../actions';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { CountryCombobox } from '@/components/ui/country-combobox';
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

// Everything the organisation page shows can be given at creation (Sjoerd,
// 2026-09-15: "Country should have a dropdown; no address"). After saving
// the organisation page opens with Add member already open, so the people
// come next rather than being a second errand.
export function NewOrgForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(createOrganisation, {});

  return (
    <form action={action} className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <TextField label={t(locale, 'name')} name="name" required errors={state.fieldErrors?.name} />
      </div>
      <TextField label={t(locale, 'domain')} name="domain" placeholder="example.org" errors={state.fieldErrors?.domain} />
      <TextField label={t(locale, 'website')} name="website" placeholder="example.org" errors={state.fieldErrors?.website} />
      <TextField label={t(locale, 'sector')} name="sector" placeholder={t(locale, 'sector_ph')} errors={state.fieldErrors?.sector} />
      <SelectField label={t(locale, 'type')} name="org_type" options={orgTypeOptions(locale)} errors={state.fieldErrors?.org_type} />
      <div className="md:col-span-2">
        <TextField label={t(locale, 'street')} name="street" errors={state.fieldErrors?.street} />
      </div>
      <TextField label={t(locale, 'postal_code')} name="postal_code" errors={state.fieldErrors?.postal_code} />
      <TextField label={t(locale, 'city')} name="city" errors={state.fieldErrors?.city} />
      <TextField label={t(locale, 'region')} name="region" errors={state.fieldErrors?.region} />
      <CountryCombobox label={t(locale, 'country')} name="country" errors={state.fieldErrors?.country} />

      {state.error && (
        <div className="md:col-span-2 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          {state.error}
        </div>
      )}

      <div className="md:col-span-2">
        <Submit locale={locale} />
      </div>
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
