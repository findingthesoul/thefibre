import { describe, expect, it } from 'vitest';
import { apiErrorResult } from './action-error';

// ---------------------------------------------------------------------------
// THE CASE THIS EXISTS FOR, first.
//
// On 2026-10-14 Sjoerd changed a member's role in a workspace where he is not
// an admin. The API answered 403 `{ error: "only admins can change members" }`
// and the dialog said "API 403". The sentence was there the whole time; the
// helper's cast could only see an object, so a plain string fell through to
// the status.
// ---------------------------------------------------------------------------
describe('the API sentence reaches the person', () => {
  it('shows a plain-string error from the API', () => {
    expect(apiErrorResult(403, { error: 'only admins can change members' })).toEqual({
      error: 'only admins can change members',
      fieldErrors: undefined,
    });
  });

  it('reads `message` when a route answers that way', () => {
    expect(apiErrorResult(409, { message: 'That code is already in use.' }).error).toBe(
      'That code is already in use.',
    );
  });

  it('reads `detail` from a problem+json body', () => {
    // The API's own 401 shape: {type, title, status, detail}. "API 401" told
    // nobody anything.
    expect(
      apiErrorResult(401, {
        type: 'https://thefibre.app/errors/missing-token',
        title: 'missing-token',
        status: 401,
        detail: 'Bearer token required',
      }).error,
    ).toBe('Bearer token required');
  });
});

describe('form validation still works', () => {
  it('passes fieldErrors through and does not invent a message', () => {
    const r = apiErrorResult(400, {
      error: { fieldErrors: { email: ['A person needs at least one email address.'] } },
    });
    expect(r.fieldErrors).toEqual({ email: ['A person needs at least one email address.'] });
    // The status, because an object error carries no sentence of its own —
    // the form shows the field errors, and a second message beside them would
    // be noise.
    expect(r.error).toBe('API 400');
  });
});

describe('when there is nothing to show', () => {
  // Each of these used to be indistinguishable from a real message, or would
  // render an empty error box, which looks like a bug rather than a refusal.
  it('falls back to the status', () => {
    for (const body of [undefined, null, {}, 'a bare string', 42, { error: 7 }]) {
      expect(apiErrorResult(500, body).error, JSON.stringify(body) ?? 'undefined').toBe('API 500');
    }
  });

  it('treats a blank or whitespace message as nothing', () => {
    expect(apiErrorResult(502, { error: '' }).error).toBe('API 502');
    expect(apiErrorResult(502, { error: '   ' }).error).toBe('API 502');
  });

  it('trims a message that has room around it', () => {
    expect(apiErrorResult(403, { error: '  not allowed\n' }).error).toBe('not allowed');
  });
});
