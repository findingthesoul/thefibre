'use client';

import { useActionState, useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { addMember, removeMember, type SaveResult } from '../actions';

export function AddMemberForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const action = addMember.bind(null, teamId);
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    action as (prev: SaveResult, fd: FormData) => Promise<SaveResult>,
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
          label="Add a member"
          name="email"
          type="email"
          placeholder="colleague@your-workspace.com"
          required
        />
      </div>
      <div className="w-40">
        <SelectField
          label="Role"
          name="role"
          defaultValue="member"
          options={[
            { value: 'member', label: 'Member' },
            { value: 'lead', label: 'Lead' },
          ]}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add'}
      </Button>
      {state.error && (
        <div className="basis-full text-sm text-red-700">{state.error}</div>
      )}
    </form>
  );
}

export function RemoveMemberButton({
  teamId,
  userId,
}: {
  teamId: string;
  userId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await removeMember(teamId, userId);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
        className="text-xs text-ink-subtle hover:text-red-700 underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? '…' : 'Remove'}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
