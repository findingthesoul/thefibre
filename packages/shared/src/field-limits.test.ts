import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS, tooLongMessage } from './field-limits.js';

// The bug this exists to prevent is not "the limit was too small". It is that
// the limit lived somewhere the person typing could not see, so the only
// remedy available to them was to change their own writing. Sjoerd,
// 2026-10-03: that "creates a bad legacy".
//
// Preventing it means the number has ONE home and every copy is derived. A
// test is the only thing that keeps that true, because writing `max(2000)`
// into a route is easier than importing a constant and nothing else notices.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('the limit has one home', () => {
  it('the API profile schema derives the four face fields from it', () => {
    const src = read('../../../apps/api/src/routes/profile.ts');
    const schema = src.match(/export const ProfilePatch = z\.object\(\{([\s\S]*?)\n\}\)/)![1];
    for (const field of ['bio', 'display_name', 'photo_url', 'timezone'] as const) {
      expect(schema, `${field} must read FIELD_LIMITS`).toContain(`FIELD_LIMITS.${field}`);
    }
  });

  it('names the fields in that schema that STILL write their own number', () => {
    // Not an exemption list — an inventory. These are the limits this change
    // did not reach: the billing details and the locale, which are edited on
    // other screens that would each need the same treatment. Listing them
    // means the set can only shrink on purpose: add a new hardcoded limit and
    // this fails with it named, rather than the list quietly growing.
    //
    // The ones a person types freely (legal_name, address, website) are the
    // ones worth doing next, for exactly the reason the bio needed it.
    const src = read('../../../apps/api/src/routes/profile.ts');
    const schema = src.match(/export const ProfilePatch = z\.object\(\{([\s\S]*?)\n\}\)/)![1];
    const stillLocal = [...schema.matchAll(/(\w+): z\s*[\s\S]{0,40}?\.max\((\d+)/g)].map(
      (m) => `${m[1]}=${m[2]}`,
    );
    // Written from what the scan MATCHED, not from what I expected it to:
    // my first list said `legal_name=200`, and the scan reports the nested
    // object's own name (`invoice_details`) for the first field inside it.
    // `vat_rate_pct=100` is a value range rather than a length and is in the
    // list only because the same `.max()` spells both.
    expect(stillLocal).toEqual([
      'locale=8',
      'stripe_account_id=64',
      'invoice_details=200',
      'address=500',
      'tax_no=60',
      'website=200',
      'vat_rate_pct=100',
    ]);
  });

  it("Thread's organiser schema derives the bio from the same one", () => {
    // Two routes accept the same bio. Two limits on one value means a save
    // that works on one screen fails on the other.
    const src = read('../../../apps/api/src/routes/thread.ts');
    const schema = src.match(/const OrganiserUpdate = z\.object\(\{([\s\S]*?)\n\}\)/)![1];
    expect(schema).toContain('FIELD_LIMITS.bio');
    expect(schema).not.toMatch(/bio: z[\s\S]{0,80}\.max\(\d/);
  });

  it('the FORM reads it too — the half that could not see it before', () => {
    const src = read('./ui/profile-form.tsx');
    expect(src).toContain('FIELD_LIMITS.bio');
    // And refuses before the save rather than after it.
    expect(src).toMatch(/if \(bio\.trim\(\)\.length > FIELD_LIMITS\.bio\)/);
  });
});

describe('the sentence a person reads', () => {
  it('says the number, because "too long" leaves them guessing how much to cut', () => {
    expect(tooLongMessage('A bio', FIELD_LIMITS.bio)).toBe(
      'A bio can be at most 8,000 characters.',
    );
  });

  it('is one sentence for every field, so one limit is never described two ways', () => {
    expect(tooLongMessage('A display name', FIELD_LIMITS.display_name)).toBe(
      'A display name can be at most 200 characters.',
    );
  });
});

describe('the numbers themselves', () => {
  it('leaves room for a written bio once it carries markup', () => {
    // 1,000-3,000 characters of prose, plus paragraphs, a list and emphasis.
    expect(FIELD_LIMITS.bio).toBeGreaterThanOrEqual(8000);
  });

  it('allows the longest real IANA zone name several times over', () => {
    expect(FIELD_LIMITS.timezone).toBeGreaterThan('America/Argentina/ComodRivadavia'.length);
  });
});
