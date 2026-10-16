'use client';

// Shown instead of Cancel / Reschedule when the page has no valid manage
// token: explains why, and offers to send a fresh link to the address the
// booking was made with (never one typed here).
import { useState, useTransition } from 'react';
import { publicT, type Locale } from '@/lib/i18n-public';
import { requestManageLink } from './manage-actions';

export function ManageLinkRequest({ bookingId, L }: { bookingId: string; L: Locale }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'sent' | 'wait' | 'error'>('idle');

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">{publicT(L, 'manage_link_explain')}</p>
      {state === 'sent' ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          {publicT(L, 'manage_link_sent')}
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await requestManageLink(bookingId);
              setState(r.ok ? 'sent' : r.rateLimited ? 'wait' : 'error');
            })
          }
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? publicT(L, 'working') : publicT(L, 'manage_link_cta')}
        </button>
      )}
      {state === 'wait' && <div className="text-sm text-neutral-600">{publicT(L, 'manage_link_wait')}</div>}
      {state === 'error' && <div className="text-sm text-red-600">{publicT(L, 'manage_link_wait')}</div>}
    </div>
  );
}
