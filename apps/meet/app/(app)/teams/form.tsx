'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/field';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { t, type Locale } from '@/lib/i18n-ui';
import { createTeam, updateTeam, type SaveResult } from './actions';
import { MEET_HOST } from '@/lib/public-host';

export type TeamFormValues = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  is_active?: boolean;
};

export function TeamForm({ initial, locale }: { initial: TeamFormValues; locale: Locale }) {
  const isEdit = !!initial.id;
  const action = isEdit ? updateTeam.bind(null, initial.id!) : createTeam;
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    action as (prev: SaveResult, fd: FormData) => Promise<SaveResult>,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <NameAndSlugFields
        nameLabel={t(locale, 'team_name')}
        slugLabel={t(locale, 'public_url')}
        initialName={initial.name ?? ''}
        initialSlug={initial.slug ?? ''}
        slugHint={`${MEET_HOST}/<this>`}
        locale={locale}
      />
      <TextAreaField
        label={t(locale, 'description')}
        name="description"
        defaultValue={initial.description ?? ''}
        rows={3}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initial.is_active ?? true}
        />
        <span>{t(locale, 'active_visible_team')}</span>
      </label>
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {t(locale, 'saved')}
        </div>
      )}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? t(locale, 'saving') : isEdit ? t(locale, 'save_changes') : t(locale, 'create_team')}
        </Button>
        <Link
          href={isEdit ? `/teams/${initial.id}` : '/teams'}
          className="text-sm text-ink-subtle hover:text-ink underline underline-offset-2"
        >
          {t(locale, 'cancel')}
        </Link>
      </div>
    </form>
  );
}
