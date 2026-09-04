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

export type InvoicePurchase = {
  id: string;
  item_label: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string;
  paid_at: string | null;
  created_at: string;
  payer_name: string;
  payer_email: string | null;
  stripe_invoice_url: string | null;
  billing?: {
    number?: string | null;
    company?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    tax_no?: string | null;
    period_end?: string | null;
    pdf?: string | null;
    subtotal_cents?: number | null;
    tax_cents?: number | null;
    tax_label?: string | null;
  } | null;
};

export type InvoiceSeller = { legal_name: string; address?: string; tax_no?: string };

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'EUR' }).format(
    cents / 100,
  );
}

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
}: {
  purchase: InvoicePurchase;
  seller: InvoiceSeller;
  open: boolean;
  onClose: () => void;
  printHref?: string;
  /** The app's own PDF endpoint — used for Download PDF when provided. */
  pdfHref?: string;
  onEmail?: (to: string) => Promise<string | null>;
}) {
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
  const date = new Date(purchase.paid_at ?? purchase.created_at);
  const settled = purchase.status !== 'pending';
  const buyerAddress = [
    b.address,
    [b.postal_code, b.city].filter(Boolean).join(' '),
    b.country,
  ]
    .filter(Boolean)
    .join(', ');
  const pdfUrl = pdfHref ?? b.pdf ?? purchase.stripe_invoice_url ?? null;
  const shareUrl =
    purchase.stripe_invoice_url ??
    (printHref && typeof window !== 'undefined' ? new URL(printHref, window.location.origin).href : null);

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
      setEmailError('Enter a valid email address.');
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
            <h2 className="text-base font-medium">{settled ? 'Receipt' : 'Invoice'}</h2>
            {b.number && <div className="font-mono text-xs text-ink-muted">{b.number}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          {shareUrl && (
            <button type="button" onClick={copyLink} className={actionBtn}>
              {copied ? 'Link copied ✓' : 'Share link'}
            </button>
          )}
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className={actionBtn}>
              Download PDF
            </a>
          )}
          {onEmail && (
            <button type="button" onClick={() => setEmailOpen((v) => !v)} className={actionBtn}>
              Email to…
            </button>
          )}
          {printHref && (
            <a href={`${printHref}?print=1`} target="_blank" rel="noreferrer" className={actionBtn}>
              Print
            </a>
          )}
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
                {emailState === 'sending' ? 'Sending…' : emailState === 'sent' ? 'Sent ✓' : 'Send'}
              </button>
            </div>
            {emailError && <p className="mt-1 text-xs text-red-700">{emailError}</p>}
          </div>
        )}

        {/* The document ------------------------------------------------ */}
        <div className="overflow-y-auto px-5 py-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <Block label="From">
              <div className="font-medium">{seller.legal_name}</div>
              {seller.address && <div className="text-ink-subtle">{seller.address}</div>}
              {seller.tax_no && <div className="text-ink-subtle">VAT: {seller.tax_no}</div>}
            </Block>
            <Block label="Billed to" right>
              <div>{b.company ?? purchase.payer_name}</div>
              {buyerAddress && <div className="text-ink-subtle">{buyerAddress}</div>}
              {b.tax_no && <div className="text-ink-subtle">VAT: {b.tax_no}</div>}
              {purchase.payer_email && <div className="text-ink-muted">{purchase.payer_email}</div>}
            </Block>
          </div>

          <div className="mt-5 rounded-md border border-line">
            <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3">
              <span className="min-w-0">{purchase.item_label}</span>
              <span className="shrink-0 font-mono">
                {money(b.subtotal_cents ?? purchase.amount_cents, purchase.currency)}
              </span>
            </div>
            {typeof b.tax_cents === 'number' && (b.tax_cents > 0 || b.tax_label) && (
              <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3 text-ink-subtle">
                <span>{b.tax_label ?? 'VAT'}</span>
                <span className="font-mono">{money(b.tax_cents, purchase.currency)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="font-medium">Total ({purchase.currency})</span>
              <span className="font-mono text-base font-medium">
                {money(purchase.amount_cents, purchase.currency)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
            <span>{date.toLocaleDateString('en-GB', { dateStyle: 'long' })}</span>
            <span>
              {purchase.method === 'stripe' ? 'Card' : purchase.method === 'invoice' ? 'By invoice' : purchase.method}
              {' · '}
              {purchase.status}
            </span>
            {b.period_end && (
              <span>
                service until {new Date(b.period_end).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
              </span>
            )}
          </div>
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
