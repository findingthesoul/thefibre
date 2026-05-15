'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { inviteInternal, type InviteResult } from './actions';

export function InviteForm() {
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
          label="Email"
          name="email"
          type="email"
          placeholder="colleague@example.com"
          required
        />
      </div>
      <div className="w-48">
        <TextField label="Name (optional)" name="name" placeholder="Full name" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Inviting…' : 'Send invite'}
      </Button>
      {state.error && (
        <div className="basis-full text-sm text-red-700">{state.error}</div>
      )}
      {state.ok && state.invited && (
        <div className="basis-full text-sm text-emerald-700">
          Invite sent. They&apos;ll appear above once they sign in.
        </div>
      )}
      {state.ok && !state.invited && (
        <div className="basis-full text-sm text-emerald-700">
          Granted Meet access to the existing user.
        </div>
      )}
    </form>
  );
}
