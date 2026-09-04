'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

// Member sign-in for the OAuth continue page — the SignInButton flow
// (app/sign-in-button.tsx) with one difference: every path lands back on
// /oauth-continue with the OAuth params intact, via /auth/callback?next=…
// (the callback treats /oauth-continue as a member route — session only,
// no workspace account required).

type Stage = 'idle' | 'enter-email' | 'enter-code';

export function ContinueSignIn({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = browserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl(),
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
        emailRedirectTo: callbackUrl(),
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
    // Session is in cookies now — go straight back to the continue page.
    window.location.href = next;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy && stage === 'idle' ? 'Redirecting…' : 'Continue with Google'}
      </button>

      {stage === 'idle' && (
        <button
          type="button"
          onClick={() => setStage('enter-email')}
          className="w-full text-sm text-neutral-500 hover:text-neutral-900 underline underline-offset-4"
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
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-md border border-neutral-200 bg-white text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
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
          <div className="text-xs text-neutral-500">
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
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base tracking-[0.3em] text-center font-mono focus:border-neutral-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length < 8}
            className="w-full rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
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
            className="block w-full text-center text-xs text-neutral-400 hover:text-neutral-600 underline underline-offset-2"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  );
}
