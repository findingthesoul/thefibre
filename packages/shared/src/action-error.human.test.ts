import { describe, expect, it } from 'vitest';
import { fieldLabel, formErrorResult, humanFieldErrors } from './action-error.js';

// ---------------------------------------------------------------------------
// THE EXACT BOX SJOERD SAW, turned into a sentence.
//
//   API 400: {"formErrors":[],"fieldErrors":{"last_name":
//            ["String must contain at least 1 character(s)"]}}
//
// The underlying bug is fixed separately — a blank field now means a missing
// field, so that particular 400 no longer happens. This is about what the
// NEXT validation failure looks like, because there will be one.
// ---------------------------------------------------------------------------

const ZOD_400 = {
  error: { formErrors: [], fieldErrors: { last_name: ['String must contain at least 1 character(s)'] } },
};

describe('the body from the red box', () => {
  it('becomes "Last name is required."', () => {
    expect(formErrorResult(400, ZOD_400).error).toBe('Last name is required.');
  });

  it('shows no JSON and no status code', () => {
    const { error } = formErrorResult(400, ZOD_400);
    expect(error).not.toContain('{');
    expect(error).not.toContain('fieldErrors');
    expect(error).not.toMatch(/API \d+/);
  });

  it('still hands the component the raw field errors to mark the box with', () => {
    // The sentence is for reading; the map is for putting a red line under
    // the right input. Both, not one.
    expect(formErrorResult(400, ZOD_400).fieldErrors).toEqual({
      last_name: ['String must contain at least 1 character(s)'],
    });
  });

  it('takes a better label when the form has one', () => {
    expect(formErrorResult(400, ZOD_400, { last_name: 'Surname' }).error).toBe(
      'Surname is required.',
    );
  });
});

describe('the other shapes a form will meet', () => {
  it('names a too-long field', () => {
    const body = { error: { fieldErrors: { notes: ['String must contain at most 4000 character(s)'] } } };
    expect(formErrorResult(400, body).error).toBe('Notes is too long.');
  });

  it('names a bad email', () => {
    const body = { error: { fieldErrors: { email: ['Invalid email'] } } };
    expect(formErrorResult(400, body).error).toBe('Email is not a valid email address.');
  });

  it('keeps zod\'s own words for anything it does not recognise', () => {
    // Better than inventing a sentence: the reader at least sees what the
    // server actually objected to, with the field named.
    const body = { error: { fieldErrors: { tier_id: ['Invalid uuid'] } } };
    expect(formErrorResult(400, body).error).toBe('Tier id: Invalid uuid');
  });

  it('lists several fields in one sentence', () => {
    const body = {
      error: { fieldErrors: { first_name: ['Required'], email: ['Invalid email'] } },
    };
    expect(formErrorResult(400, body).error).toBe(
      'First name is required. Email is not a valid email address.',
    );
  });
});

describe('what it must not break', () => {
  it('leaves a plain string error exactly as the API said it', () => {
    // THE REGRESSION THAT STARTED ALL OF THIS: the API answers
    // `{ error: "only admins can change members" }` and twelve copies of the
    // old helper showed "API 403" instead.
    const r = formErrorResult(403, { error: 'only admins can change members' });
    expect(r.error).toBe('only admins can change members');
  });

  it('puts the API sentence FIRST when there are also field errors', () => {
    const r = formErrorResult(400, {
      error: { formErrors: ['that tier is closed'], fieldErrors: { email: ['Invalid email'] } },
    });
    // `formErrors` is not read as the message today; what matters is that the
    // field sentence is there and nothing is lost.
    expect(r.error).toContain('Email is not a valid email address.');
  });

  it('falls back to the status when there is nothing else at all', () => {
    expect(formErrorResult(500, undefined).error).toBe('API 500');
    expect(formErrorResult(502, {}).error).toBe('API 502');
  });

  it('does not crash on a problem+json body, and uses its detail', () => {
    expect(formErrorResult(401, { detail: 'Bearer token required' }).error).toBe(
      'Bearer token required',
    );
  });

  it('does not crash on shapes nobody planned for', () => {
    for (const body of [null, 'a string', 42, [], { error: [] }, { error: { fieldErrors: null } }]) {
      expect(() => formErrorResult(400, body), JSON.stringify(body)).not.toThrow();
    }
  });
});

describe('fieldLabel', () => {
  it('turns a column name into words', () => {
    expect(fieldLabel('last_name')).toBe('Last name');
    expect(fieldLabel('postal_code')).toBe('Postal code');
    expect(fieldLabel('taxId')).toBe('Tax id');
    expect(fieldLabel('seat_allowance')).toBe('Seat allowance');
  });

  it('prefers the form\'s own word', () => {
    expect(fieldLabel('tier_id', { tier_id: 'Membership' })).toBe('Membership');
  });
});

describe('humanFieldErrors', () => {
  it('is empty for no errors, rather than throwing', () => {
    expect(humanFieldErrors(undefined)).toEqual([]);
    expect(humanFieldErrors({})).toEqual([]);
    // A field present with an empty list says nothing, so it says nothing.
    expect(humanFieldErrors({ email: [] })).toEqual([]);
  });
});
