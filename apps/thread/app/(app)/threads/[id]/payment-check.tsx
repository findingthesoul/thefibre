'use client';

// The check before a PAID thread goes live (Sjoerd, 2026-10-16: "before
// going live, a check screen would be nice. Something like: the payment for
// these events will go to: ..."). Shown when publishing, and when opening
// public sign-up on a live thread. Free threads skip it.
//
// What it says comes from GET /threads/:id/payment-route — resolved by the
// functions a real payment uses — and is never worked out here. If the route
// cannot be read the action goes ahead: the server's publish guard still
// refuses a thread with no working way to pay.

import { useState, type ReactNode } from 'react';
import type { Locale } from '@thefibre/shared';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n-ui';
import { getPaymentRoute, type PaymentRoute } from '../actions';

type Paid = Extract<PaymentRoute, { paid: true }>;

export function usePaymentCheck({
  threadId,
  locale,
  onChangeDestination,
}: {
  threadId: string;
  locale: Locale;
  /** Opens the thread's payment setting. */
  onChangeDestination: () => void;
}): { check: (kind: 'publish' | 'open', proceed: () => void) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<{ route: Paid; kind: 'publish' | 'open'; proceed: () => void } | null>(null);

  async function check(kind: 'publish' | 'open', proceed: () => void) {
    const route = await getPaymentRoute(threadId);
    if (!route || !route.paid) return proceed();
    setPending({ route, kind, proceed });
  }

  const dialog = pending ? (
    <Dialog
      open
      onClose={() => setPending(null)}
      title={t(locale, 'pay_check_title')}
      description={t(locale, 'pay_check_intro')}
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            className="mr-auto"
            onClick={() => {
              setPending(null);
              onChangeDestination();
            }}
          >
            {t(locale, 'pay_check_change')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              const go = pending.proceed;
              setPending(null);
              go();
            }}
          >
            {t(locale, pending.kind === 'publish' ? 'pay_check_publish' : 'pay_check_open')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink">
        {pending.route.card && (
          <p>
            {t(locale, 'pay_check_card', { name: pending.route.card.owner_name })}
            {pending.route.card.stripe_name && pending.route.card.stripe_name !== pending.route.card.owner_name && (
              <span className="block text-ink-muted">{t(locale, 'pay_check_card_stripe', { stripe: pending.route.card.stripe_name })}</span>
            )}
          </p>
        )}
        {pending.route.invoice && (
          <p>
            {pending.route.invoice.seller_name
              ? t(locale, 'pay_check_invoice', { seller: pending.route.invoice.seller_name })
              : t(locale, 'pay_check_invoice_unnamed')}
          </p>
        )}
      </div>
    </Dialog>
  ) : null;

  return { check, dialog };
}
