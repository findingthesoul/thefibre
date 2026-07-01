'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTeam } from '../actions';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextAreaField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'thread.thefibre.app';

export function NewTeamForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const slug = String(fd.get('slug') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim();
    if (!name) return setError('Give the team a name.');
    if (!slug) return setError('Pick a URL slug.');

    startTransition(async () => {
      const r = await createTeam({
        name,
        slug,
        description: description || null,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/teams/${r.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      <NameAndSlugFields
        nameLabel="Name"
        prefix={`${THREAD_HOST}/`}
        slugHint="Lowercase letters, digits and hyphens. Teams share the root slug namespace with organisers."
      />

      <TextAreaField
        label="Description"
        name="description"
        rows={3}
        hint="What this team is for — shown to members."
      />

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create team'}
        </Button>
      </div>
    </form>
  );
}
