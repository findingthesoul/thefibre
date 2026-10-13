// Which terms a member agrees to, and what gets recorded.
//
// The version is the part that matters: a consent record says "they accepted
// THESE words", and the one-live-per-version index means a later version is a
// new row rather than a silent collision. So the version must change when the
// words can change, and must not change when they cannot.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveTerms, standardTermsUrl, STANDARD_TERMS_VERSION } from './terms.js';

describe('resolveTerms', () => {
  it('uses the workspace’s own terms when it set one', () => {
    const r = resolveTerms('https://soul.com/terms');
    expect(r.url).toBe('https://soul.com/terms');
    expect(r.standard, 'and says they are not ours').toBe(false);
  });

  it('falls back to the standard terms when it has not', () => {
    for (const empty of [null, undefined, '', '   ']) {
      const r = resolveTerms(empty, { FIBRE_ENV: 'production' } as NodeJS.ProcessEnv);
      expect(r.standard, `${JSON.stringify(empty)} means standard`).toBe(true);
      expect(r.url).toBe('https://thethread.app/terms/standard');
    }
  });

  it('records a workspace’s own terms by their URL, because we cannot version them', () => {
    // We do not host that page and cannot know when it is edited. "They
    // accepted what was at this address on this date" is the honest record;
    // claiming a version we did not control would be worse evidence than
    // claiming none.
    const r = resolveTerms('https://soul.com/terms');
    expect(r.version).toBe('https://soul.com/terms');
  });

  it('records the standard terms by a real version, because we do control them', () => {
    const r = resolveTerms(null);
    expect(r.version).toBe(STANDARD_TERMS_VERSION);
    // The draft marker is deliberate: the text has not been approved, and an
    // acceptance recorded against it should say so for as long as that is
    // true.
    expect(STANDARD_TERMS_VERSION).toMatch(/draft/);
  });

  it('points at the right stack', () => {
    expect(standardTermsUrl({ FIBRE_ENV: 'staging' } as NodeJS.ProcessEnv)).toContain('thefibre.tech');
    expect(standardTermsUrl({ FIBRE_ENV: 'production' } as NodeJS.ProcessEnv)).toContain('thethread.app');
    // An explicit website URL wins over both, so a preview deploy can point
    // at itself.
    expect(
      standardTermsUrl({ NEXT_PUBLIC_WEBSITE_URL: 'https://preview.example/' } as NodeJS.ProcessEnv),
    ).toBe('https://preview.example/terms/standard');
  });
});

describe('the join refuses to take money without an acceptance', () => {
  const src = readFileSync(new URL('../routes/membership.ts', import.meta.url), 'utf8');

  it('refuses the request itself, not just the form', () => {
    // A checkbox can be bypassed; this is an agreement, so the API is where
    // the refusal has to live.
    expect(src).toContain('terms_accepted: z.boolean().default(false)');
    expect(src).toContain("message: 'the terms and conditions must be accepted before paying'");
  });

  it('carries which terms were accepted to the webhook, and records them there', () => {
    expect(src).toContain('terms_version: joinTerms.version');
    expect(src).toContain("purpose_code: 'terms_of_service'");
    // Recorded when the membership BEGINS, like the directory consent: a
    // visitor who never pays has agreed to nothing that matters.
    expect(src).toContain('await recordTermsAcceptance(meta)');
  });

  it('and Stripe is not asked to price anything', () => {
    // Sjoerd, 2026-10-13: "nothing of Stripe is the rule, except payment".
    // A promotion code typed on Stripe's page would be a second discount
    // system whose decisions never reach our ledger.
    expect(src).not.toContain('allow_promotion_codes');
  });
});
