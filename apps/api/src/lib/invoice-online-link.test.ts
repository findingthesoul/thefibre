// Which stack does a receipt send somebody to?
//
// The expensive direction is a PRODUCTION receipt carrying a staging link: a
// paying customer clicks "see this invoice", lands on a test stack, and
// nothing in the product notices — the kind of wrong only ever found by the
// person it happened to. So production is asserted, and so is staging,
// because a test that pinned only production would stay green if staging
// quietly started pointing at production too, and then the people checking
// staging would be checking the wrong database's data.
//
// The two stacks are right for DIFFERENT reasons, which is the thing to know
// before changing either:
//   production  has no NEXT_PUBLIC_MY_URL, and falls back to the constant in
//               branding.ts. Checked on the live app, not assumed.
//   staging     has the secret set, and `surfaceUrl` has no request host to
//               infer from in an email, so the secret is the ONLY thing
//               keeping a staging receipt off the production portal.

import { describe, expect, it } from 'vitest';
import { invoiceOnlineButtonHtml, invoiceOnlineUrl } from './invoice-online-link.js';
// The one seam every receipt, invoice and payment-link email passes through.
import { receiptHtml } from '../routes/purchases.js';

const ID = '5864861e-d470-478b-930c-07cf9f77cce7';

describe('where the button points', () => {
  // THE case. thefibre-api has no NEXT_PUBLIC_MY_URL (verified against the
  // live app on 2026-10-11), so an email from production resolves the
  // constant.
  it('production, with nothing set, points at the production portal', () => {
    expect(invoiceOnlineUrl(ID, {})).toBe(`https://my.thethread.app/purchases/${ID}`);
  });

  it('staging, with the secret set, points at the staging portal', () => {
    expect(invoiceOnlineUrl(ID, { NEXT_PUBLIC_MY_URL: 'https://my.thefibre.tech' })).toBe(
      `https://my.thefibre.tech/purchases/${ID}`,
    );
  });

  // A receipt has no request host to infer from, so this is not a theoretical
  // fallback — it is the whole mechanism on one of the two stacks.
  it('never guesses a host from anywhere else', () => {
    const prod = invoiceOnlineUrl(ID, {});
    expect(prod).not.toContain('thefibre.tech');
    expect(prod).not.toContain('localhost');
  });

  it('is the deep link to one invoice, not the list', () => {
    expect(invoiceOnlineUrl(ID, {})).toMatch(/\/purchases\/[0-9a-f-]{36}$/);
  });
});

describe('the button', () => {
  const html = invoiceOnlineButtonHtml(ID, { NEXT_PUBLIC_MY_URL: 'https://my.thefibre.tech' });

  it('carries the link', () => {
    expect(html).toContain(`https://my.thefibre.tech/purchases/${ID}`);
  });

  // A link that promises an invoice and delivers an auth wall reads as a
  // broken link, and the person who gives up is the one who needed a receipt.
  it('says that signing in is part of it', () => {
    expect(html.toLowerCase()).toContain('sign in');
  });

  // THE SECURITY PROPERTY. An invoice email is forwarded, quoted and left in
  // shared inboxes; a token in this URL would make every one of those a
  // disclosure of somebody's payment history. The uuid alone opens nothing.
  it('carries no token, key or signature', () => {
    const url = html.match(/href="([^"]+)"/)?.[1] ?? '';
    expect(url).not.toContain('?');
    expect(url).not.toMatch(/token|key|sig|jwt|auth/i);
    // Nothing but the origin, the path and the id.
    expect(new URL(url).pathname).toBe(`/purchases/${ID}`);
    expect(new URL(url).search).toBe('');
  });

  it('is an ordinary absolute link, openable from any mail client', () => {
    const url = html.match(/href="([^"]+)"/)?.[1] ?? '';
    expect(url.startsWith('https://')).toBe(true);
  });
});

// ── THE WIRING ──────────────────────────────────────────────────────────────
//
// Everything above proves the BUILDER. This proves the email actually carries
// it — a distinction that has already bitten this session once, when the
// staging-mail helpers were all correct and only an end-to-end check showed
// whether sendEmail applied them.
//
// `receiptHtml` is the one seam every receipt, invoice and payment-link email
// passes through, which is why the button lives there and why testing it here
// covers all three without three tests that could drift apart.

const ROW = {
  id: ID,
  payer_name: 'Nora Visser',
  payer_email: 'nora@example.com',
  item_label: 'Workshop: staying in the room',
  amount_cents: 8500,
  currency: 'EUR',
  method: 'invoice',
  status: 'paid',
  created_at: '2026-10-11T10:00:00.000Z',
};

describe('the email body carries the button', () => {
  it('on a receipt', () => {
    const html = receiptHtml(ROW, '');
    expect(html).toContain('/purchases/' + ID);
    expect(html.toLowerCase()).toContain('sign in');
  });

  it('on an unpaid invoice too', () => {
    const html = receiptHtml({ ...ROW, status: 'pending' }, '');
    expect(html).toContain('/purchases/' + ID);
  });

  // The payment-link email passes a Pay button through the same argument.
  // Both must survive: the Pay button is what to press now, this one is for
  // the person coming back weeks later for the document.
  it('beside a Pay button, without displacing it', () => {
    const html = receiptHtml(ROW, '<p><a href="https://pay.example/x">Pay online</a></p>');
    expect(html).toContain('Pay online');
    expect(html).toContain('/purchases/' + ID);
  });

  // A row with no id must lose the button rather than render one pointing at
  // /purchases/undefined, which would be a broken promise in a real receipt.
  it('is omitted entirely when there is no id to link to', () => {
    const { id: _dropped, ...noId } = ROW;
    const html = receiptHtml(noId, '');
    expect(html).not.toContain('/purchases/');
    expect(html).not.toContain('undefined');
    // And the rest of the invoice is still there.
    expect(html).toContain('Workshop: staying in the room');
  });
});
