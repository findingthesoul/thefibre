'use client';

// Email + an 8-digit code. Sjoerd, 2026-09-08: "Login is email + code…
// simple." No Google button here on purpose — a visitor arriving from a
// ticket email has already proved they hold that mailbox, and offering four
// ways in is how a simple door stops feeling simple.

import { useState } from 'react';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { browserSupabase } from '@/lib/supabase/client';
import { t } from '@/lib/i18n';
import { parts } from '@/lib/i18n-parts';

type Stage = 'email' | 'code';

export function SignIn() {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await browserSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/?welcome=1')}`,
        // An account is created on first sign-in. Enrolling already creates
        // one (email-only); this is the same door from the other side.
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      // Supabase's own sentence is English and sometimes technical. The
      // reader gets one of ours, in their language; the original goes to the
      // console for whoever is debugging.
      console.warn('[sign-in] code not sent', error);
      setError(error.status === 429 ? t(locale, 'code_wait') : t(locale, 'code_send_failed'));
      return;
    }
    setStage('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    const { error } = await browserSupabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (error) {
      console.warn('[sign-in] code not accepted', error);
      setError(error.status === 429 ? t(locale, 'code_wait') : t(locale, 'code_invalid'));
      setBusy(false);
      return;
    }
    window.location.href = `/auth/callback?next=${encodeURIComponent('/?welcome=1')}`;
  }

  const field =
    'w-full rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none';
  const button =
    'w-full rounded-lg bg-ink px-5 py-3 text-sm font-medium text-ink-inverse hover:opacity-90 disabled:opacity-50';

  if (stage === 'code') {
    return (
      <form onSubmit={verify} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm text-ink-subtle">
            {parts(t(locale, 'code_sent'), { email: <span className="text-ink">{email}</span> })}
          </label>
          <input
            id="code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder={t(locale, 'code_placeholder')}
            className={`${field} mt-2 tracking-[0.3em]`}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={button}>
          {busy ? t(locale, 'verifying') : t(locale, 'sign_in')}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage('email');
            setCode('');
            setError(null);
          }}
          className="w-full text-sm text-ink-muted hover:text-ink"
        >
          {t(locale, 'use_different_email')}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-ink-subtle">
          {t(locale, 'your_email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          className={`${field} mt-2`}
        />
        <p className="mt-2 text-sm text-ink-muted">
          {t(locale, 'email_hint')}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={button}>
        {busy ? t(locale, 'sending') : t(locale, 'email_me_code')}
      </button>
    </form>
  );
}
