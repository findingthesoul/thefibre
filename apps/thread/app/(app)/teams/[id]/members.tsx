'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/dialog';
import { SectionLabel } from '@/components/ui/page';
import { addTeamMember, removeTeamMember } from '../actions';

type Candidate = {
  user_id: string;
  full_name: string | null;
  email: string;
  workspace_role: string;
};

export function AddMemberRow({
  teamId,
  candidates,
}: {
  teamId: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'lead' | 'member'>('member');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Everyone in the workspace is already on this team.
      </p>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!userId) return setError('Pick a workspace member.');
    startTransition(async () => {
      const r = await addTeamMember(teamId, userId, role);
      if (!r.ok) return setError(r.error);
      setUserId('');
      setRole('member');
      router.refresh();
    });
  }

  return (
    <div>
      <SectionLabel>Add a member</SectionLabel>
      <form onSubmit={onSubmit} className="mt-2 flex flex-wrap items-end gap-3 max-w-3xl">
        <div className="flex-1 min-w-[16rem]">
          <SelectField
            label="Workspace member"
            name="user_id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={[
              { value: '', label: 'Choose a member…' },
              ...candidates.map((c) => ({
                value: c.user_id,
                label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
              })),
            ]}
          />
        </div>
        <div className="w-32">
          <SelectField
            label="Role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value === 'lead' ? 'lead' : 'member')}
            options={[
              { value: 'member', label: 'Member' },
              { value: 'lead', label: 'Lead' },
            ]}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </Button>
        {error && <div className="basis-full text-sm text-red-700">{error}</div>}
      </form>
    </div>
  );
}

export function RemoveMemberButton({
  teamId,
  userId,
  name,
}: {
  teamId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await removeTeamMember(teamId, userId);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink-muted hover:text-red-700 transition-colors"
        aria-label={`Remove ${name} from the team`}
        title="Remove from team"
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={onConfirm}
        title="Remove member"
        message={`Remove ${name} from this team? They keep their workspace access — only the team membership goes.`}
        confirmLabel="Remove"
        destructive
        pending={pending}
      />
    </>
  );
}
