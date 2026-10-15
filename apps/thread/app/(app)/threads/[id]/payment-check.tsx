'use client';

// The check before a PAID thread goes live (Sjoerd, 2026-10-16: "before
// going live, a check screen would be nice. Something like: the payment for
// these events will go to: ..."). Shown when publishing, and when opening
// public sign-up on a live thread. Free threads skip it.
//
// What it says comes from GET /threads/:id/payment-route — resolved by the
// functions a real payment uses — and is never worked out here.
//
// FAIL CLOSED. If the route cannot be read the dialog still appears, saying
// so ("We couldn't check where payments go. Publish anyway?"). It used to
// go ahead silently, which defeats the screen: the publish guard covers a
// thread with NO way to pay, and this exists for the WRONG way to pay.

import { useState, type ReactNode } from 'react';
import type { Locale } from '@thefibre/shared';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n-ui';
import { getPaymentRoute, type PaymentRoute } from '../actions';

type Paid = Extract<PaymentRoute, { paid: true }>;
/** What the dialog shows: the route, or that it could not be read. */
type Shown = { route: Paid | null; kind: 'publish' | 'open'; proceed: () => void; cancel?: () => void };

export function usePaymentCheck({
  threadId,
  locale,
  onChangeDestination,
}: {
  threadId: string;
  locale: Locale;
  /** Opens the thread's payment setting. */
  onChangeDestination: () => void;
}): {
  check: (kind: 'publish' | 'open', proceed: () => void, cancel?: () => void) => void;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Shown | null>(null);

  async function check(kind: 'publish' | 'open', proceed: () => void, cancel?: () => void) {
    const route = await getPaymentRoute(threadId);
    if (route && !route.paid) return proceed();
    setPending({ route: route && route.paid ? route : null, kind, proceed, cancel });
  }
  function dismiss() {
    pending?.cancel?.();
    setPending(null);
  }

  const dialog = pending ? (
    <Dialog
      open
      onClose={dismiss}
      title={t(locale, 'pay_check_title')}
      description={pending.route ? t(locale, 'pay_check_intro') : undefined}
      size="md"
      footer={
        <>
          {pending.route ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                dismiss();
                onChangeDestination();
              }}
            >
              {t(locale, 'pay_check_change')}
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="mr-auto" onClick={dismiss}>
              {t(locale, 'cancel')}
            </Button>
          )}
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
        {!pending.route && <p>{t(locale, 'pay_check_unknown')}</p>}
        {pending.route?.card && (
          <p>
            {t(locale, 'pay_check_card', { name: pending.route.card.owner_name })}
            {pending.route.card.stripe_name && pending.route.card.stripe_name !== pending.route.card.owner_name && (
              <span className="block text-ink-muted">{t(locale, 'pay_check_card_stripe', { stripe: pending.route.card.stripe_name })}</span>
            )}
          </p>
        )}
        {pending.route?.invoice && (
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
