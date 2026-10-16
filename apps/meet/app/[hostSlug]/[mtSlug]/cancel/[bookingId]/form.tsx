'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBooking } from './actions';
import { publicT, type Locale } from '@/lib/i18n-public';

export function CancelForm({
  bookingId,
  token,
  hostSlug,
  L,
}: {
  bookingId: string;
  token: string;
  hostSlug: string;
  L: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        {publicT(L, 'cancelled_done')}
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
            const r = await cancelBooking(bookingId, token);
            if (r.error) setError(r.error);
            else {
              setDone(true);
              // Back to this page marked as just cancelled: it re-renders the
              // cancelled booking with the success line, not "already
              // cancelled".
              router.replace(
                `?${token ? `t=${encodeURIComponent(token)}&` : ''}cancelled=1`,
              );
            }
          });
        }}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {pending ? publicT(L, 'working') : publicT(L, 'cancel_button')}
      </button>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="text-xs text-neutral-500">
        {publicT(L, 'cancel_nothing_yet')}
      </div>
    </div>
  );
}
