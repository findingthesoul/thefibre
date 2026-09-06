'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { t, type Locale } from '@/lib/i18n-ui';
import { updateHost, type SaveResult } from '../actions';

export function PersonalRoomForm({
  initial,
  locale,
}: {
  initial: string;
  locale: Locale;
}) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );
  return (
    <form
      action={formAction}
      className="rounded-lg border border-line bg-surface-raised p-6 space-y-4"
    >
      <TextField
        label={t(locale, 'personal_room_url')}
        name="personal_room_url"
        defaultValue={initial}
        placeholder="https://zoom.us/j/…"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t(locale, 'saving') : t(locale, 'save')}
        </Button>
        {state.ok && <span className="text-xs text-emerald-700">{t(locale, 'saved')}</span>}
        {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
