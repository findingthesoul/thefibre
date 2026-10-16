'use client';

// The card a membership renews on — and changing it, HERE (Purchases, P4).
// Sjoerd, 2026-10-15: "Manage payment should not go to Stripe."
//
// Card details never reach our servers: Stripe's own PaymentElement runs in
// this page on the COMMUNITY's connected account, against a SetupIntent the
// API makes; we only ever see a payment-method id and the last four. Dark
// until the platform's publishable key is set (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY):
// without it the line shows the card and no "change".

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { browserSupabase } from '@/lib/supabase/client';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { toLocale, type Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';

// Stripe's own form speaks the reader's language too. pt is Brazilian here,
// as everywhere in this app (INTL_LOCALES.pt).
const STRIPE_LOCALE: Record<Locale, 'en' | 'nl' | 'es' | 'pt-BR' | 'de' | 'fr'> = {
  en: 'en',
  nl: 'nl',
  es: 'es',
  pt: 'pt-BR',
  de: 'de',
  fr: 'fr',
};

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
type Card = { brand: string; last4: string; exp_month: number; exp_year: number } | null;
const brandName = (b: string) => (b ? b.charAt(0).toUpperCase() + b.slice(1) : '');

async function api<T>(path: string, body?: unknown, locale?: Locale): Promise<T> {
  const {
    data: { session },
  } = await browserSupabase().auth.getSession();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const res = await fetch(`${base}/api/v1/membership/portal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? t(toLocale(locale), 'something_wrong_status', { status: res.status }));
  return json;
}

export function CardLine({ memberId }: { memberId: string }) {
  const [card, setCard] = useState<Card | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  useEffect(() => {
    api<{ card: Card }>(`/me/payment-method/${memberId}`).then(
      (r) => setCard(r.card),
      () => setCard(null),
    );
  }, [memberId]);
  if (card === undefined) return null;
  return (
    <p className="mt-1 text-xs text-ink-subtle">
      {card ? t(locale, 'card_line', { brand: brandName(card.brand), last4: card.last4 }) : t(locale, 'no_card')}
      {PK && (
        <>
          {' · '}
          <button type="button" onClick={() => setOpen(true)} className="underline underline-offset-2 hover:text-ink">
            {t(locale, 'change')}
          </button>
        </>
      )}
      {open && <ChangeCard memberId={memberId} onClose={() => setOpen(false)} onChanged={setCard} />}
    </p>
  );
}

function ChangeCard({ memberId, onClose, onChanged }: { memberId: string; onClose: () => void; onChanged: (c: Card) => void }) {
  const [setup, setSetup] = useState<{ client_secret: string; setup_intent_id: string; stripe_account: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useMemo(() => `card_${crypto.randomUUID().replace(/-/g, '')}`, []);
  const locale = useLocale();
  useEffect(() => {
    api<{ client_secret: string; setup_intent_id: string; stripe_account: string }>(`/me/payment-method/${memberId}/setup`, { request_id: requestId }, locale).then(
      setSetup,
      (e: Error) => setError(e.message),
    );
  }, [memberId, requestId, locale]);
  // Stripe.js on the community's account, loaded once per dialog.
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (setup ? loadStripe(PK, { stripeAccount: setup.stripe_account }) : null),
    [setup],
  );

  if (error || !setup || !stripePromise) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={t(locale, 'change_card_title')}
        description={t(locale, 'change_card_desc')}
        footer={
          <Button type="button" variant="ghost" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
        }
      >
        {error ? <p className={NOTICE.error}>{error}</p> : <p className="text-sm text-ink-subtle">{t(locale, 'loading')}</p>}
      </Dialog>
    );
  }
  // Elements wraps the WHOLE dialog, so the buttons in its footer can reach
  // Stripe's hooks. The footer is the Fibre bottom bar: pinned, while the
  // body (the card form) scrolls under it on a short screen (2026-10-16:
  // "Save card" sat below the fold at 720px).
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: setup.client_secret, locale: STRIPE_LOCALE[locale] }}>
      <CardDialog memberId={memberId} setupIntentId={setup.setup_intent_id} onClose={onClose} onChanged={onChanged} />
    </Elements>
  );
}

function CardDialog({ memberId, setupIntentId, onClose, onChanged }: { memberId: string; setupIntentId: string; onClose: () => void; onChanged: (c: Card) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Card>(null);
  const locale = useLocale();

  async function save() {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    // Stripe confirms the card in the browser (3-D Secure in its own frame);
    // then our API re-reads the SetupIntent and makes the card the default.
    const { error: e } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (e) {
      setError(e.message ?? t(locale, 'card_not_confirmed'));
      setBusy(false);
      return;
    }
    try {
      const r = await api<{ card: Card }>(`/me/payment-method/${memberId}/confirm`, { setup_intent_id: setupIntentId }, locale);
      setDone(r.card);
      onChanged(r.card);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'change_card_title')}
      description={t(locale, 'change_card_desc')}
      footer={
        done ? (
          <Button type="button" onClick={onClose}>
            {t(locale, 'close')}
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t(locale, 'cancel')}
            </Button>
            <Button type="button" onClick={save} disabled={!stripe || busy}>
              {busy ? t(locale, 'saving') : t(locale, 'save_card')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className={NOTICE.success}>{t(locale, 'card_saved', { brand: brandName(done.brand), last4: done.last4 })}</p>
      ) : (
        <div className="space-y-3">
          {/* Card only, and no Link box: "Save my information for faster
              checkout" and its email field made this dialog long and read
              as a second sign-up (2026-10-16). Wallets are off for the same
              reason — this is "change your card", not a checkout. */}
          <PaymentElement options={{ layout: 'tabs', wallets: { link: 'never', applePay: 'never', googlePay: 'never' } }} />
          {error && <p className={NOTICE.error}>{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
