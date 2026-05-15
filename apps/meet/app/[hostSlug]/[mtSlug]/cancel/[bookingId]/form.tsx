'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBooking } from './actions';

export function CancelForm({
  bookingId,
  hostSlug,
}: {
  bookingId: string;
  hostSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        Booking cancelled. A confirmation email is on its way.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await cancelBooking(bookingId);
            if (r.error) setError(r.error);
            else {
              setDone(true);
              router.refresh();
            }
          });
        }}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {pending ? 'Cancelling…' : 'Cancel booking'}
      </button>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="text-xs text-neutral-500">
        Changed your mind? Just close this page — nothing is cancelled until you confirm.
      </div>
    </div>
  );
}
