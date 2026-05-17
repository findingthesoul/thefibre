'use client';

import { useActionState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { updateHost, type SaveResult } from '../actions';

type Initial = {
  stripe_account_id: string | null;
};

export function PaymentsForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );

  const connected = !!initial.stripe_account_id;

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-lg border border-line bg-surface-raised p-6">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">Stripe Connect</span>
          {connected ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="h-3 w-3" strokeWidth={2} /> Connected
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-surface-sunken text-ink-muted border border-line">
              Not connected
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-subtle">
          Paste your Stripe account ID below. Find it at{' '}
          <a
            href="https://dashboard.stripe.com/settings/account"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 inline-flex items-center gap-1"
          >
            Stripe → Settings → Account details
            <ExternalLink className="h-3 w-3" />
          </a>
          . Format: <code className="text-xs">acct_xxx</code>.
        </p>

        <div className="mt-5">
          <TextField
            label="Stripe account ID"
            name="stripe_account_id"
            defaultValue={initial.stripe_account_id ?? ''}
            placeholder="acct_1Nv…"
            autoComplete="off"
            spellCheck={false}
            hint="Leave blank to disconnect. You'll need to clear price on any paid meeting types first."
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Saved.
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>

      <p className="text-xs text-ink-muted leading-relaxed">
        v0.13.x ships the connection only. Stripe Checkout on paid bookings,
        invoice mode, refunds, and invoice emails are queued — see{' '}
        <a
          href="https://github.com/findingthesoul/thefibre/blob/main/docs/meet-pricing-roadmap.md"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          the roadmap
        </a>
        .
      </p>
    </form>
  );
}
