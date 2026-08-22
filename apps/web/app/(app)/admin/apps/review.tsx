'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { reviewApp } from './actions';

export function ReviewButtons({
  slug,
  status,
  kind,
}: {
  slug: string;
  status: 'pending' | 'approved' | 'suspended';
  kind: 'first_party' | 'third_party';
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function decide(action: 'approve' | 'suspend' | 'reinstate') {
    setError(null);
    start(async () => {
      const r = await reviewApp(slug, action);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  // A first-party app is part of the platform build; there is nothing here to
  // decide about it.
  if (kind === 'first_party') {
    return <div className="text-xs uppercase tracking-wider text-ink-muted">Built in</div>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === 'pending' && (
          <>
            <Button variant="secondary" size="sm" onClick={() => decide('suspend')} disabled={pending}>
              Reject
            </Button>
            <Button size="sm" onClick={() => decide('approve')} disabled={pending}>
              {pending ? 'Working…' : 'Approve'}
            </Button>
          </>
        )}
        {status === 'approved' && (
          <Button variant="secondary" size="sm" onClick={() => decide('suspend')} disabled={pending}>
            {pending ? 'Working…' : 'Suspend'}
          </Button>
        )}
        {status === 'suspended' && (
          <Button size="sm" onClick={() => decide('reinstate')} disabled={pending}>
            {pending ? 'Working…' : 'Reinstate'}
          </Button>
        )}
      </div>
      {status === 'approved' && (
        <span className="text-[11px] text-ink-muted">Suspending revokes its keys and turns it off everywhere.</span>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
