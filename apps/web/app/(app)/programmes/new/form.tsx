'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { createProgramme } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

const formatOptions = (locale: Locale) => [
  { value: '', label: '—' },
  { value: 'meeting', label: `${t(locale, 'format_meeting')} — Meet` },
  { value: 'event', label: `${t(locale, 'format_event')} — Thread` },
  { value: 'journey', label: `${t(locale, 'format_journey')} — Thread` },
  { value: 'self_paced', label: `${t(locale, 'format_self_paced')} — Learn` },
  { value: 'blended', label: `${t(locale, 'format_blended')} — Learn` },
];

export function NewProgrammeForm({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(createProgramme, {});
  return (
    <form action={action} className="mt-8 space-y-4">
      <TextField label={t(locale, 'title_label')} name="title" required errors={state.fieldErrors?.title} />
      <SelectField label={t(locale, 'format')} name="format" required options={formatOptions(locale)} errors={state.fieldErrors?.format} hint={t(locale, 'format_hint')} />
      <DateField label={t(locale, 'start_date')} name="starts_on" />
      <DateField label={t(locale, 'end_date')} name="ends_on" />

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
      {pending ? t(locale, 'creating') : t(locale, 'create_programme')}
    </Button>
  );
}
