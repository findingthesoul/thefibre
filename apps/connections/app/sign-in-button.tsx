'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

type Stage = 'idle' | 'enter-email' | 'enter-code';

export function SignInButton() {
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
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      console.error(error);
      setError(error.message);
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      console.error(error);
      setError(error.message);
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
      setError(error.message);
      setBusy(false);
      return;
    }
    window.location.href = '/auth/callback';
  }

  return (
    <div className="space-y-3 max-w-sm">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-md bg-ink text-ink-inverse px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy && stage === 'idle' ? 'Redirecting…' : 'Continue with Google'}
      </button>

      {stage === 'idle' && (
        <button
          type="button"
          onClick={() => setStage('enter-email')}
          className="w-full text-sm text-ink-subtle hover:text-ink underline underline-offset-4"
        >
          or sign in with an email code
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
            {busy ? 'Sending…' : 'Email me a sign-in code'}
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
            Check <strong>{email}</strong>. Enter the 8-digit code below, or
            click the link in the email.
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="12345678"
            required
            autoFocus
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-base tracking-[0.3em] text-center font-mono focus:border-line-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length < 8}
            className="w-full rounded-md bg-ink text-ink-inverse px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Sign in'}
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
            Use a different email
          </button>
        </form>
      )}

      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  );
}
