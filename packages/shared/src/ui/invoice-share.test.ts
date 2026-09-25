// The share link must point at US.
//
// It used to end `?? purchase.stripe_invoice_url`, so any app that gave the
// dialog no page of its own silently handed out Stripe's hosted invoice —
// another company's document, with another company's branding, as the
// canonical reference to our sale. Sjoerd caught it on 2026-09-25, having
// caught the same thing on Download PDF in September.
//
// There is no unit to call here — the URL is computed inside a React
// component — so this reads the SOURCE and asserts the fallback is gone.
// A grep test is weak evidence of behaviour and strong evidence of intent:
// it fails the moment somebody reintroduces the line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(import.meta.dirname, 'invoice-dialog.tsx'), 'utf8');

describe('invoice share link', () => {
  it('never falls back to the Stripe-hosted invoice', () => {
    const from = src.indexOf('const shareUrl');
    const to = src.indexOf('async function copyLink');
    // Both anchors must exist, or this test passes on an empty string and
    // proves nothing — the failure mode it is meant to catch.
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(src.slice(from, to)).not.toMatch(/stripe/i);
  });

  it('does not offer Stripe as the Download PDF either', () => {
    const from = src.indexOf('const pdfUrl');
    const to = src.indexOf('const abs =');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(src.slice(from, to)).not.toMatch(/stripe/i);
  });
});
