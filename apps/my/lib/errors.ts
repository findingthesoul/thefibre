// What went wrong, said in the reader's language (2026-10-17).
//
// A member on production saw "Token has expired or is invalid" — Supabase's
// own English, with no hint what to do. The rule here: an error's TEXT is for
// developers; the reader gets a sentence from the catalog, chosen by what the
// error IS — its code when it has one, its HTTP status when not. An API's
// English message survives only as the last resort, for a validation message
// nothing else can describe, and even then inside a sentence in the reader's
// language.
//
// Pure functions: the caller passes the error and the locale.

import type { Locale } from '@thefibre/shared/i18n';
import { t, type MyKey } from './i18n';

/** Supabase's auth error, as far as we read it. */
export type AuthErrorLike = { code?: string | null; status?: number | null; message?: string | null } | null;

export type AuthErrorView = {
  key: MyKey;
  vars?: Record<string, string | number>;
  /** Offer "Send a new code" beside the sentence. */
  resend?: boolean;
};

/** Seconds from "you can only request this after 52 seconds", if present. */
function waitSeconds(message: string | null | undefined): number | null {
  const m = message?.match(/after (\d+) seconds?/i);
  return m ? Number(m[1]) : null;
}

/**
 * Sign-in errors. `stage` is which step failed: sending the code, or
 * checking it.
 */
export function authErrorView(err: AuthErrorLike, stage: 'send' | 'verify'): AuthErrorView {
  const code = err?.code ?? '';
  const status = err?.status ?? 0;
  if (code.startsWith('over_') || status === 429) {
    const n = waitSeconds(err?.message);
    return n ? { key: 'code_wait_seconds', vars: { n } } : { key: 'code_wait' };
  }
  if (stage === 'verify') {
    // GoTrue says otp_expired for both "too old" and "not this code"; either
    // way the useful next step is a fresh code.
    if (code === 'otp_expired' || /expired|invalid/i.test(err?.message ?? '')) return { key: 'code_expired', resend: true };
    return { key: 'code_invalid', resend: true };
  }
  if (code === 'email_address_invalid' || code === 'validation_failed' || /invalid format|validate email/i.test(err?.message ?? '')) {
    return { key: 'email_invalid' };
  }
  return { key: 'code_send_failed' };
}

/** Any error thrown by an API call: something with a status, maybe a code. */
type ApiErrorLike = { status?: number; code?: string; message?: string };

/** Codes an API sends that have a sentence of their own. */
const CODE_KEYS: Record<string, MyKey> = {
  session_expired: 'err_session_ended',
  not_signed_in: 'err_session_ended',
};

/** A sentence for an API failure. Never the API's English alone. */
export function friendlyError(e: unknown, locale: Locale): string {
  // fetch() itself failed: no answer at all.
  if (e instanceof TypeError) return t(locale, 'err_offline');
  const err = (e ?? {}) as ApiErrorLike;
  if (err.code && CODE_KEYS[err.code]) return t(locale, CODE_KEYS[err.code]!);
  switch (err.status) {
    case 401:
      return t(locale, 'err_session_ended');
    case 403:
      return t(locale, 'err_not_allowed');
    case 404:
    case 410:
      return t(locale, 'err_gone');
    case 409:
      return t(locale, 'err_conflict');
    case 429:
      return t(locale, 'join_err_too_many');
    default:
      break;
  }
  if (typeof err.status === 'number' && err.status >= 500) return t(locale, 'join_err_server');
  // A 400/422 is usually a validation message, the one kind no status can
  // describe. Keep its detail — English, from the API — inside the reader's
  // own sentence. Nothing at all to go on: the generic sentence.
  const detail = (err.message ?? '').trim();
  if (detail && typeof err.status === 'number') return t(locale, 'err_failed_detail', { detail });
  return t(locale, 'something_wrong');
}
