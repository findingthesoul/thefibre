'use client';

// "Start a Thread" as a popup, right here on thethread.app — no page, no
// apex hop. Every CTA on the site renders a StartButton; clicking opens
// this dialog, which submits the same signup request the Fibre's
// request-access page files. With auto-approve on (signup v2, the
// default) the success state says "you're in — sign in"; the velvet-rope
// mode degrades to "we'll be in touch".

import { useActionState, useEffect, useRef, useState } from 'react';
import { submitStartRequest, type StartRequestResult } from '@/app/actions';
import { APP_URL } from '@/lib/site';

const FIELD =
  'w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none';

export function StartButton({
  plan,
  className,
  children,
}: {
  plan?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <StartDialog plan={plan} onClose={() => setOpen(false)} />}
    </>
  );
}

function StartDialog({ plan, onClose }: { plan?: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<StartRequestResult, FormData>(
    submitStartRequest,
    {},
  );
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Start a Thread"
    >
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-surface p-7 shadow-2xl md:p-8">
        {state.ok ? (
          <div>
            <h2 className="text-xl font-bold">
              {state.approved
                ? 'You’re in.'
                : state.alreadyRequested
                  ? 'You already asked — good.'
                  : 'Request received.'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
              {state.approved
                ? 'Your workspace is ready and a welcome email is on its way. Sign in and start your first thread.'
                : state.alreadyRequested
                  ? 'There is already a request for this email address. Check your inbox — the answer may be waiting there.'
                  : 'We read every request personally and come back to you by email, usually within a day.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink-subtle transition-colors hover:border-ink hover:text-ink"
              >
                Close
              </button>
              {state.approved && (
                <a
                  href={APP_URL}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-ink transition-all hover:-translate-y-px"
                >
                  Sign in
                </a>
              )}
            </div>
          </div>
        ) : (
          <form action={formAction}>
            <h2 className="text-xl font-bold">Start a Thread</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
              Tell us who you are and we&apos;ll set you up — free means free, one live event,
              forever.
            </p>
            {plan && <input type="hidden" name="desired_plan" value={plan} />}
            <div className="mt-5 space-y-3">
              <input
                ref={nameRef}
                name="full_name"
                required
                maxLength={200}
                placeholder="Your name"
                className={FIELD}
              />
              <input
                name="email"
                type="email"
                required
                placeholder="Email address"
                className={FIELD}
              />
              <input
                name="organisation_name"
                maxLength={200}
                placeholder="Organisation (optional)"
                className={FIELD}
              />
              <textarea
                name="reason"
                rows={3}
                maxLength={2000}
                placeholder="What are you weaving? (optional)"
                className={FIELD}
              />
            </div>
            {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink-subtle transition-colors hover:border-ink hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-ink transition-all hover:-translate-y-px disabled:opacity-60"
              >
                {pending ? 'Sending…' : 'Start a Thread'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
