'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { t, type Locale } from '@/lib/i18n-ui';
import { inviteInternal, type InviteResult } from './actions';

export function InviteForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InviteResult, FormData>(
    inviteInternal,
    {},
  );

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        router.refresh();
      }}
      className="flex flex-wrap items-end gap-3 max-w-3xl"
    >
      <div className="flex-1 min-w-[16rem]">
        <TextField
          label={t(locale, 'email')}
          name="email"
          type="email"
          placeholder="colleague@example.com"
          required
        />
      </div>
      <div className="w-48">
        <TextField label={t(locale, 'name_optional')} name="name" placeholder={t(locale, 'full_name')} />
      </div>
      <div className="w-40">
        <SelectField
          label={t(locale, 'relationship')}
          name="relationship_type"
          defaultValue="internal"
          options={[
            { value: 'internal', label: t(locale, 'internal') },
            { value: 'external', label: t(locale, 'external') },
          ]}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t(locale, 'inviting') : t(locale, 'send_invite')}
      </Button>
      {state.error && (
        <div className="basis-full text-sm text-red-700">{state.error}</div>
      )}
      {state.ok && state.invited && (
        <div className="basis-full text-sm text-emerald-700">
          {t(locale, 'invite_sent_internal')}
        </div>
      )}
      {state.ok && !state.invited && (
        <div className="basis-full text-sm text-emerald-700">
          {t(locale, 'granted_access')}
        </div>
      )}
    </form>
  );
}
