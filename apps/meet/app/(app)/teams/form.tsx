'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/field';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { createTeam, updateTeam, type SaveResult } from './actions';
import { MEET_HOST } from '@/lib/public-host';

export type TeamFormValues = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  is_active?: boolean;
};

export function TeamForm({ initial }: { initial: TeamFormValues }) {
  const isEdit = !!initial.id;
  const action = isEdit ? updateTeam.bind(null, initial.id!) : createTeam;
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    action as (prev: SaveResult, fd: FormData) => Promise<SaveResult>,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <NameAndSlugFields
        nameLabel="Team name"
        initialName={initial.name ?? ''}
        initialSlug={initial.slug ?? ''}
        slugHint={`${MEET_HOST}/<this>`}
      />
      <TextAreaField
        label="Description"
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
        <span>Active (visible at the team URL)</span>
      </label>
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Saved.
        </div>
      )}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create team'}
        </Button>
        <Link
          href={isEdit ? `/teams/${initial.id}` : '/teams'}
          className="text-sm text-ink-subtle hover:text-ink underline underline-offset-2"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
