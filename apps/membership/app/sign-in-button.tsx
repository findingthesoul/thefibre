'use client';

// Sign-in for Membership's surfaces: Google OAuth plus the platform's
// passwordless 8-digit email code (Supabase OTP — same flow as
// apps/thread/app/sign-in-button.tsx). Copy comes from the shared
// participant-auth catalog via lib/i18n, so the /my portal renders it in
// the member's locale.

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

type Stage = 'idle' | 'enter-email' | 'enter-code';

export function SignInButton({
  next = '/dashboard',
  locale = 'en',
}: { next?: string; locale?: Locale } = {}) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = browserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      console.error(error);
      setError(t(locale, 'something_wrong'));
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = browserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      console.error(error);
      setError(t(locale, 'code_send_failed'));
      return;
    }
    setStage('enter-code');
  }

  async function verifyCode() {
    if (code.length < 8) return;
    setBusy(true);
    setError(null);
    const supabase = browserSupabase();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    if (error) {
      console.error(error);
      setError(t(locale, 'code_invalid'));
      setBusy(false);
      return;
    }
    window.location.href = `/auth/callback?next=${encodeURIComponent(next)}`;
  }

  return (
    <div className="space-y-3 max-w-sm">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-md bg-ink text-ink-inverse px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy && stage === 'idle' ? t(locale, 'redirecting') : t(locale, 'sign_in_google')}
      </button>

      {stage === 'idle' && (
        <button
          type="button"
          onClick={() => setStage('enter-email')}
          className="w-full text-sm text-ink-subtle hover:text-ink underline underline-offset-4"
        >
          {t(locale, 'email_me_code')}
        </button>
      )}

      {stage === 'enter-email' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          className="space-y-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-md border border-line bg-surface-raised text-ink px-4 py-2 text-sm font-medium hover:bg-surface-sunken disabled:opacity-50"
          >
            {busy ? t(locale, 'sending') : t(locale, 'email_me_code')}
          </button>
        </form>
      )}

      {stage === 'enter-code' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyCode();
          }}
          className="space-y-2"
        >
          <div className="text-xs text-ink-subtle">
            {t(locale, 'code_sent', { email })}
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="12345678"
            aria-label={t(locale, 'enter_code')}
            required
            autoFocus
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-base tracking-[0.3em] text-center font-mono focus:border-line-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length < 8}
            className="w-full rounded-md bg-ink text-ink-inverse px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t(locale, 'verifying') : t(locale, 'verify_code')}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage('enter-email');
              setCode('');
              setError(null);
            }}
            className="block w-full text-center text-xs text-ink-muted hover:text-ink-subtle underline underline-offset-2"
          >
            {t(locale, 'use_different_email')}
          </button>
        </form>
      )}

      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  );
}
