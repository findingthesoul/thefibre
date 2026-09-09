'use client';

// THE canonical invoice viewer — one popup for the whole family (Sjoerd,
// 2026-09-04: "open an invoice in a popup with a share button… one ref of
// truth for the whole app — fibre, meet, thread"). Renders the document from
// a purchase-ledger row and offers: share link, download PDF, email to,
// print. Apps supply only the wiring: the row, the seller block, an email
// callback, and the print-page href.
//
// Self-contained dialog chrome (same look as each app's Dialog contract, all
// on the shared surface/ink/line tokens) so no app-local Dialog import is
// needed from inside the shared package.

import { useEffect, useState, type ReactNode } from 'react';
import { INTL_LOCALES } from '../i18n.js';
import {
  invoiceModel,
  type InvoicePurchase,
  type InvoiceSeller,
} from '../invoice-model.js';
import { chromeT, useLocale, type ChromeKey } from './i18n-ui.js';

// The shape and the composition are decided once, in ../invoice-model.js,
// and shared with the PDF and the invoice email. Re-exported here because
// the apps already import these names from this module.
export type { InvoicePurchase, InvoiceSeller } from '../invoice-model.js';

function moneyIn(intl: string, cents: number, currency: string): string {
  return new Intl.NumberFormat(intl, { style: 'currency', currency: currency || 'EUR' }).format(
    cents / 100,
  );
}

const STATUS_KEYS: Record<string, ChromeKey> = {
  pending: 'status_pending',
  paid: 'status_paid',
  refunded: 'status_refunded',
  failed: 'status_failed',
};

export function InvoiceDialog({
  purchase,
  seller,
  open,
  onClose,
  /** Absolute or app-relative href of the full-page (printable) invoice. */
  printHref,
  pdfHref,
  /** Send the receipt/invoice email to an address; resolve to error text or null. */
  onEmail,
  actions,
  children,
}: {
  purchase: InvoicePurchase;
  /** Omit when the app cannot name the seller — the From block is hidden. */
  seller?: InvoiceSeller;
  open: boolean;
  onClose: () => void;
  printHref?: string;
  /** The app's own PDF endpoint — used for Download PDF when provided. */
  pdfHref?: string;
  onEmail?: (to: string) => Promise<string | null>;
  /** App-side management buttons (reimburse, mark paid, …) — rendered in the
   *  action bar after the built-ins. The document stays canonical; what an
   *  app can DO to a purchase stays the app's. */
  actions?: ReactNode;
  /** Extra rows under the document (fee split, refund notes, notices). */
  children?: ReactNode;
}) {
  const locale = useLocale();
  const intl = INTL_LOCALES[locale];
  const money = (cents: number, currency: string) => moneyIn(intl, cents, currency);
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const b = purchase.billing ?? {};
  const m = invoiceModel(purchase, seller);
  const date = new Date(m.dateIso);
  const settled = m.kind === 'receipt';
  const pdfUrl = pdfHref ?? b.pdf ?? purchase.stripe_invoice_url ?? null;
  // The share link is OUR invoice page — Stripe's hosted copy only when the
  // app gave us no page at all (the ledger is the record, Stripe is rails).
  const shareUrl =
    (printHref && typeof window !== 'undefined'
      ? new URL(printHref, window.location.origin).href
      : null) ?? purchase.stripe_invoice_url;

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is still visible via Stripe copy */
    }
  }

  async function sendTo() {
    if (!onEmail || !/.+@.+\..+/.test(emailTo)) {
      setEmailError(chromeT(locale, 'enter_valid_email'));
      return;
    }
    setEmailState('sending');
    setEmailError(null);
    const err = await onEmail(emailTo);
    if (err) {
      setEmailState('error');
      setEmailError(err);
    } else {
      setEmailState('sent');
      setTimeout(() => {
        setEmailOpen(false);
        setEmailState('idle');
        setEmailTo('');
      }, 1500);
    }
  }

  const actionBtn =
    'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-raised px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-line bg-surface-raised shadow-xl">
        {/* Header + actions ------------------------------------------- */}
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-medium">
              {settled ? chromeT(locale, 'receipt') : chromeT(locale, 'invoice')}
            </h2>
            {m.number && <div className="font-mono text-xs text-ink-muted">{m.number}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label={chromeT(locale, 'close')}
            className="text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          {shareUrl && (
            <button type="button" onClick={copyLink} className={actionBtn}>
              {copied ? chromeT(locale, 'link_copied') : chromeT(locale, 'share_link')}
            </button>
          )}
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className={actionBtn}>
              {chromeT(locale, 'download_pdf')}
            </a>
          )}
          {onEmail && (
            <button type="button" onClick={() => setEmailOpen((v) => !v)} className={actionBtn}>
              {chromeT(locale, 'email_to')}
            </button>
          )}
          {printHref && (
            <a href={`${printHref}?print=1`} target="_blank" rel="noreferrer" className={actionBtn}>
              {chromeT(locale, 'print')}
            </a>
          )}
          {actions}
        </div>

        {emailOpen && (
          <div className="border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="bookkeeper@example.org"
                className="h-8 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-line-strong"
              />
              <button
                type="button"
                onClick={sendTo}
                disabled={emailState === 'sending'}
                className="inline-flex h-8 shrink-0 items-center rounded-md bg-ink px-3 text-xs font-medium text-ink-inverse hover:opacity-90 disabled:opacity-50"
              >
                {emailState === 'sending'
                  ? chromeT(locale, 'sending')
                  : emailState === 'sent'
                    ? chromeT(locale, 'sent')
                    : chromeT(locale, 'send')}
              </button>
            </div>
            {emailError && <p className="mt-1 text-xs text-red-700">{emailError}</p>}
          </div>
        )}

        {/* The document ------------------------------------------------ */}
        <div className="overflow-y-auto px-5 py-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            {seller && (
              <Block label={chromeT(locale, 'from')}>
                <div className="font-medium">{m.seller.name}</div>
                {m.seller.address && <div className="text-ink-subtle">{m.seller.address}</div>}
                {m.seller.taxNo && (
                  <div className="text-ink-subtle">{chromeT(locale, 'vat')}: {m.seller.taxNo}</div>
                )}
              </Block>
            )}
            <Block label={chromeT(locale, 'billed_to')} right={Boolean(seller)}>
              <div>{m.buyer.name}</div>
              {m.buyer.address && <div className="text-ink-subtle">{m.buyer.address}</div>}
              {m.buyer.taxNo && (
                <div className="text-ink-subtle">{chromeT(locale, 'vat')}: {m.buyer.taxNo}</div>
              )}
              {m.buyer.email && <div className="text-ink-muted">{m.buyer.email}</div>}
            </Block>
          </div>

          <div className="mt-5 rounded-md border border-line">
            <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3">
              <span className="min-w-0">{m.line.label}</span>
              <span className="shrink-0 font-mono">
                {money(m.line.amountCents, m.currency)}
              </span>
            </div>
            {m.totals.tax && (
              <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3 text-ink-subtle">
                <span>{m.totals.tax.label ?? chromeT(locale, 'vat')}</span>
                <span className="font-mono">{money(m.totals.tax.amountCents, m.currency)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="font-medium">
                {chromeT(locale, 'total_currency', { currency: m.currency })}
              </span>
              <span className="font-mono text-base font-medium">
                {money(m.totals.totalCents, m.currency)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
            <span>{date.toLocaleDateString(intl, { dateStyle: 'long' })}</span>
            <span>
              {m.method === 'card'
                ? chromeT(locale, 'method_card')
                : m.method === 'invoice' || m.method === 'invoice_awaiting'
                  ? chromeT(locale, 'by_invoice')
                  : m.raw.method}
              {' · '}
              {STATUS_KEYS[m.raw.status]
                ? chromeT(locale, STATUS_KEYS[m.raw.status]!)
                : m.raw.status}
            </span>
            {b.period_end && (
              <span>
                {chromeT(locale, 'service_until', {
                  date: new Date(b.period_end).toLocaleDateString(intl, { dateStyle: 'medium' }),
                })}
              </span>
            )}
          </div>
          {children && <div className="mt-4 border-t border-line pt-3 text-xs">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function Block({ label, right, children }: { label: string; right?: boolean; children: ReactNode }) {
  return (
    <div className={right ? 'text-right' : ''}>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  );
}
