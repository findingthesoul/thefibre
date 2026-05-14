'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { decideRequest } from './actions';

export function DecideButtons({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function decide(action: 'approve' | 'deny') {
    setError(null);
    start(async () => {
      const r = await decideRequest(requestId, action);
      if (r.error) {
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => decide('deny')}
          disabled={pending}
        >
          Deny
        </Button>
        <Button size="sm" onClick={() => decide('approve')} disabled={pending}>
          {pending ? 'Working…' : 'Approve'}
        </Button>
      </div>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
