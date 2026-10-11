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
  it('the API profile schema derives the five face fields from it', () => {
    const src = read('../../../apps/api/src/routes/profile.ts');
    const schema = src.match(/export const ProfilePatch = z\.object\(\{([\s\S]*?)\n\}\)/)![1];
    for (const field of ['bio', 'short_bio', 'display_name', 'photo_url', 'timezone'] as const) {
      expect(schema, `${field} must read FIELD_LIMITS`).toContain(`FIELD_LIMITS.${field}`);
    }
  });

  it('names the fields in that schema that STILL write their own number', () => {
    // Not an exemption list — an inventory, and it has done its job: the six
    // it named on 2026-10-03 (locale, stripe_account_id, and the four billing
    // details) are gone, each now reading FIELD_LIMITS. What is left is ONE
    // entry, and it is not a length at all.
    //
    // Listing them means the set can only shrink on purpose: add a new
    // hardcoded limit and this fails with it named, rather than the list
    // quietly growing.
    const src = read('../../../apps/api/src/routes/profile.ts');
    const schema = src.match(/export const ProfilePatch = z\.object\(\{([\s\S]*?)\n\}\)/)![1];
    const stillLocal = [...schema.matchAll(/(\w+): z\s*[\s\S]{0,40}?\.max\((\d+)/g)].map(
      (m) => `${m[1]}=${m[2]}`,
    );
    // `vat_rate_pct=100` is a VALUE RANGE — a percentage can be 0 to 100 —
    // and appears here only because `.max()` spells both a length and a
    // bound. Sharing it with the form would mean teaching FIELD_LIMITS, whose
    // whole subject is "how many characters", to also mean "how large a
    // number", and a module that means two things is how the next person gets
    // it wrong. It stays.
    expect(stillLocal).toEqual(['vat_rate_pct=100']);
  });

  it('the billing details and the account id derive theirs', () => {
    const src = read('../../../apps/api/src/routes/profile.ts');
    const schema = src.match(/export const ProfilePatch = z\.object\(\{([\s\S]*?)\n\}\)/)![1];
    for (const field of [
      'legal_name',
      'address',
      'tax_no',
      'website',
      'stripe_account_id',
      'locale',
    ] as const) {
      expect(schema, `${field} must read FIELD_LIMITS`).toContain(`FIELD_LIMITS.${field}`);
    }
  });

  it('the BILLING form reads them too, and stops the typing', () => {
    const src = read('./ui/payments-form.tsx');
    // maxLength is the clearest refusal there is: the character never
    // arrives, so there is nothing to explain afterwards.
    for (const field of [
      'legal_name',
      'address',
      'tax_no',
      'website',
      'stripe_account_id',
    ] as const) {
      expect(src, `${field} must cap its input from FIELD_LIMITS`).toContain(
        `maxLength={FIELD_LIMITS.${field}}`,
      );
    }
    // And the belt, for a value that was pasted or put there programmatically
    // rather than typed.
    expect(src).toContain('tooLongMessage(');

    // `locale` deliberately has NO form check: it is chosen from a select, so
    // a length refusal could never fire. Asserted so the absence reads as a
    // decision rather than an omission.
    expect(src).not.toContain('FIELD_LIMITS.locale');
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

  it('the form counts and refuses the SHORT bio against the same number', () => {
    const src = read('./ui/profile-form.tsx');
    expect(src).toMatch(/if \(shortBio\.trim\(\)\.length > FIELD_LIMITS\.short_bio\)/);
    // The counter shows the limit, so the person sees it before the save.
    expect(src).toContain('FIELD_LIMITS.short_bio.toLocaleString');
  });
});

describe('the sentence a person reads', () => {
  it('says the number, because "too long" leaves them guessing how much to cut', () => {
    expect(tooLongMessage('A bio', FIELD_LIMITS.bio)).toBe(
      'A bio can be at most 8,000 characters.',
    );
  });

  it('says the short bio limit the same way', () => {
    expect(tooLongMessage('A short bio', FIELD_LIMITS.short_bio)).toBe(
      'A short bio can be at most 280 characters.',
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
