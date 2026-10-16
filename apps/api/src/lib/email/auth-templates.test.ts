// Sign-in emails carry the CODE ONLY (2026-10-16). A mail scanner that GETs
// every link consumed the one-time token through the email's verify button,
// so the code the member typed always failed ("Token has expired or is
// invalid") — proven on staging. These lock it: for the actions
// signInWithOtp sends, neither the HTML nor the plain text carries a verify
// URL, in every language, and the code is there. Invite / recovery / email
// change keep their link.

import { describe, expect, it } from 'vitest';
import { LOCALES } from '@thefibre/shared/i18n';
import { CODE_ONLY, renderAuthEmail } from './auth-templates.js';

const VERIFY = 'https://abc.supabase.co/auth/v1/verify?token=pkce_secret_hash&type=magiclink&redirect_to=https%3A%2F%2Fmy.thethread.app%2Fauth%2Fcallback';
const args = { email: 'member@example.org', token: '12345678', confirmationUrl: VERIFY, validityMinutes: 30 };

describe('code-only sign-in emails', () => {
  for (const action of ['magiclink', 'signup', 'login'] as const) {
    for (const loc of LOCALES) {
      it(`${action} · ${loc}: the code, and no verify link in HTML or text`, () => {
        const r = renderAuthEmail(action, args, loc);
        for (const part of [r.html, r.text]) {
          expect(part).not.toContain('/auth/v1/verify');
          expect(part).not.toContain('pkce_secret_hash');
        }
        expect(r.html).toContain('12345678');
        expect(r.text).toContain('1 2 3 4 5 6 7 8');
      });
    }
  }

  it('the set is exactly what signInWithOtp sends', () => {
    expect([...CODE_ONLY].sort()).toEqual(['login', 'magiclink', 'signup']);
  });

  it('with NO code (never expected), a sign-in email keeps its link rather than arriving empty', () => {
    const r = renderAuthEmail('magiclink', { ...args, token: null }, 'en');
    expect(r.html).toContain('/auth/v1/verify');
  });

  for (const action of ['invite', 'recovery', 'email_change_new'] as const) {
    it(`${action} keeps its link (a link by nature; no app's sign-in sends it)`, () => {
      const r = renderAuthEmail(action, args, 'en');
      expect(r.html).toContain('/auth/v1/verify');
      expect(r.text).toContain('/auth/v1/verify');
    });
  }
});
