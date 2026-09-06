'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPerson } from '../actions';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { t, type Locale } from '@/lib/i18n-ui';

export function NewPersonForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(createPerson, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <TextField label={t(locale, 'first_name')} name="first_name" required errors={state.fieldErrors?.first_name} />
      <TextField label={t(locale, 'last_name')} name="last_name" required errors={state.fieldErrors?.last_name} />
      <TextField label={t(locale, 'email_label')} name="email" type="email" required errors={state.fieldErrors?.email} />
      <TextField label={t(locale, 'country_iso')} name="country" placeholder="NL" maxLength={2} errors={state.fieldErrors?.country} />

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
      {pending ? t(locale, 'saving') : t(locale, 'add_person')}
    </Button>
  );
}
