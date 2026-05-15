'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addAssignee, removeAssignee } from '../actions';

export type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
};

export type Assignee = {
  user_id: string;
  is_primary: boolean;
  user: TeamMember | TeamMember[] | null;
};

export function AssigneesEditor({
  mtId,
  members,
  assignees,
}: {
  mtId: string;
  members: TeamMember[];
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assignedById = new Map(assignees.map((a) => [a.user_id, a]));

  function toggle(userId: string, isAssigned: boolean) {
    setError(null);
    startTransition(async () => {
      const r = isAssigned
        ? await removeAssignee(mtId, userId)
        : await addAssignee(
            mtId,
            userId,
            // First assignee becomes primary by default.
            assignees.length === 0,
          );
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  function setPrimary(userId: string) {
    setError(null);
    startTransition(async () => {
      const r = await addAssignee(mtId, userId, true);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  if (members.length === 0) {
    return (
      <div className="text-sm text-ink-subtle">
        Add members to the team first, then assign them here.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {members.map((m) => {
        const assigned = assignedById.get(m.id);
        const isAssigned = !!assigned;
        const isPrimary = assigned?.is_primary === true;
        return (
          <div
            key={m.id}
            className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface-raised px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <input
                type="checkbox"
                checked={isAssigned}
                disabled={pending}
                onChange={() => toggle(m.id, isAssigned)}
              />
              <div className="min-w-0">
                <div className="text-sm">{m.full_name ?? m.email}</div>
                <div className="text-xs text-ink-subtle truncate">{m.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isAssigned && (
                <label className="flex items-center gap-1.5 text-xs text-ink-subtle">
                  <input
                    type="radio"
                    name="primary"
                    checked={isPrimary}
                    disabled={pending}
                    onChange={() => setPrimary(m.id)}
                  />
                  Primary
                </label>
              )}
            </div>
          </div>
        );
      })}
      {error && <div className="text-sm text-red-700">{error}</div>}
    </div>
  );
}
