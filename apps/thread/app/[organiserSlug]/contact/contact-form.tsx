'use client';

// The form itself. Posts straight to the public API — there is nothing to
// keep server-side, and a round trip through a server action would only add
// a hop between the visitor and a message.
//
// The `website` field is a honeypot: hidden from people, irresistible to the
// bots that fill every input they find. The API treats a filled one as a
// successful send and delivers nothing, which is what stops a bot learning
// which field gave it away.

import { useState } from 'react';
import { publicFetch } from '@/lib/public-api';

export function ContactForm({ ownerSlug }: { ownerSlug: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState('sending');
    try {
      await publicFetch('/api/v1/thread/public/contact', {
        method: 'POST',
        body: JSON.stringify({
          owner: ownerSlug,
          name: String(fd.get('name') ?? ''),
          email: String(fd.get('email') ?? ''),
          message: String(fd.get('message') ?? ''),
          website: String(fd.get('website') ?? ''),
        }),
      });
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  if (state === 'sent') {
    return (
      <p className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Sent. They will reply to the address you gave.
      </p>
    );
  }

  const input =
    'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-ink-subtle focus:outline-none';

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <label className="block">
        <span className="text-sm text-ink-subtle">Your name</span>
        <input name="name" required maxLength={200} className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-ink-subtle">Your email</span>
        <input name="email" type="email" required maxLength={200} className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-ink-subtle">Message</span>
        <textarea name="message" required rows={6} maxLength={5000} className={input} />
      </label>

      {/* Honeypot. Hidden from people and from screen readers; bots fill it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state === 'failed' && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          That did not send. Try again in a moment.
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="inline-flex h-10 items-center rounded-md bg-ink px-5 text-sm font-medium text-ink-inverse hover:opacity-90 disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
