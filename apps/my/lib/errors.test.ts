import { describe, expect, it } from 'vitest';
import { authErrorView, friendlyError } from './errors';
import { PortalApiError } from './portal-api';
import { t } from './i18n';

// What the portal client throws: an Error carrying the HTTP status (and a code
// when the API sends one). Built here, so the test needs no browser client.
const api = (status: number, message: string, code?: string) => Object.assign(new Error(message), { status, code });

// The sentence a member reads when something fails. Never the provider's
// English: on 2026-10-17 a member saw "Token has expired or is invalid".

describe('sign-in errors', () => {
  it('turns Supabase’s expired/invalid code into "ask for a new one", with a resend', () => {
    const v = authErrorView({ code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' }, 'verify');
    expect(v).toEqual({ key: 'code_expired', resend: true });
    expect(t('nl', v.key)).toBe('Deze code werkt niet meer. Vraag een nieuwe aan.');
  });

  it('reads the wait out of the rate limit', () => {
    const v = authErrorView(
      { code: 'over_email_send_rate_limit', status: 429, message: 'For security purposes, you can only request this after 52 seconds.' },
      'send',
    );
    expect(v).toEqual({ key: 'code_wait_seconds', vars: { n: 52 } });
    expect(t('de', v.key, v.vars)).toContain('52');
  });

  it('falls back to "a minute" when the rate limit names no number', () => {
    expect(authErrorView({ status: 429, message: 'Too many requests' }, 'send')).toEqual({ key: 'code_wait' });
  });

  it('says an address is malformed', () => {
    expect(authErrorView({ code: 'email_address_invalid', status: 400 }, 'send').key).toBe('email_invalid');
    expect(authErrorView({ status: 400, message: 'Unable to validate email address: invalid format' }, 'send').key).toBe(
      'email_invalid',
    );
  });

  it('has a sentence for anything else, at either step', () => {
    expect(authErrorView({ status: 500, message: 'boom' }, 'send').key).toBe('code_send_failed');
    expect(authErrorView({ status: 400, message: 'something new' }, 'verify')).toEqual({ key: 'code_invalid', resend: true });
    expect(authErrorView(null, 'send').key).toBe('code_send_failed');
  });
});

describe('API errors', () => {
  it('says what a status means, in the reader’s language, and never the API’s English', () => {
    expect(friendlyError(new PortalApiError(401, 'sign in required'), 'nl')).toBe(t('nl', 'err_session_ended'));
    expect(friendlyError(api(403, 'forbidden'), 'fr')).toBe(t('fr', 'err_not_allowed'));
    expect(friendlyError(api(404, 'not found'), 'es')).toBe(t('es', 'err_gone'));
    expect(friendlyError(api(409, 'stale'), 'pt')).toBe(t('pt', 'err_conflict'));
    expect(friendlyError(api(429, 'slow down'), 'de')).toBe(t('de', 'join_err_too_many'));
    expect(friendlyError(api(500, 'Internal error'), 'nl')).toBe(t('nl', 'join_err_server'));
  });

  it('a fetch that never reached the server is "check your connection"', () => {
    expect(friendlyError(new TypeError('Failed to fetch'), 'nl')).toBe(t('nl', 'err_offline'));
  });

  it('keeps a validation message’s detail, inside the reader’s own sentence', () => {
    expect(friendlyError(api(400, 'VAT number is not valid'), 'nl')).toBe('Dat lukte niet: VAT number is not valid');
  });

  it('with nothing to go on, the generic sentence', () => {
    expect(friendlyError(api(400, ''), 'nl')).toBe(t('nl', 'something_wrong'));
    expect(friendlyError(undefined, 'en')).toBe(t('en', 'something_wrong'));
  });
});
