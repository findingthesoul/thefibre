'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { grantThreadAccess } from './actions';

export function GrantAccessButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onGrant() {
    setError(null);
    startTransition(async () => {
      const r = await grantThreadAccess(userId, 'member');
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-700">{error}</span>}
      <Button
        size="sm"
        variant="secondary"
        leading={<UserPlus size={14} strokeWidth={1.75} />}
        onClick={onGrant}
        disabled={pending}
      >
        {pending ? 'Granting…' : 'Grant access'}
      </Button>
    </div>
  );
}
