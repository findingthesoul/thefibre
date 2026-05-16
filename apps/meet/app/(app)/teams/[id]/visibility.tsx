'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setTeamVisibility } from '../actions';

export function VisibilityCard({
  teamId,
  initial,
  disabled,
}: {
  teamId: string;
  initial: 'members_only' | 'org_wide';
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: 'members_only' | 'org_wide') {
    if (next === value) return;
    setError(null);
    setValue(next);
    startTransition(async () => {
      const r = await setTeamVisibility(teamId, next);
      if (r.error) {
        setError(r.error);
        setValue(initial); // revert
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input
          type="radio"
          checked={value === 'members_only'}
          disabled={disabled || pending}
          onChange={() => change('members_only')}
          className="mt-1"
        />
        <div className="min-w-0">
          <div className="font-medium">Members only</div>
          <div className="text-xs text-ink-subtle mt-0.5">
            Only members of this team can see the team and its bookings.
          </div>
        </div>
      </label>
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input
          type="radio"
          checked={value === 'org_wide'}
          disabled={disabled || pending}
          onChange={() => change('org_wide')}
          className="mt-1"
        />
        <div className="min-w-0">
          <div className="font-medium">Org-wide</div>
          <div className="text-xs text-ink-subtle mt-0.5">
            Every internal member of the organisation can see this team and its
            members. Externals still only see what they're directly added to.
          </div>
        </div>
      </label>
      {error && <div className="text-xs text-red-700">{error}</div>}
      {disabled && (
        <div className="text-xs text-ink-muted">
          Only the team's leads (or an org admin) can change visibility.
        </div>
      )}
    </div>
  );
}
