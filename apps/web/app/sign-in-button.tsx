'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

async function startGoogleSignIn(
  setBusy: (b: boolean) => void,
  setError: (e: string | null) => void,
) {
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

async function sendCode(
  email: string,
  setBusy: (b: boolean) => void,
  setStage: (s: 'enter-code') => void,
  setError: (e: string | null) => void,
) {
  setBusy(true);
  setError(null);
  const supabase = browserSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Email contains BOTH a one-time code and a magic-link as fallback.
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

async function verifyCode(
  email: string,
  code: string,
  setBusy: (b: boolean) => void,
  setError: (e: string | null) => void,
) {
  setBusy(true);
  setError(null);
  const supabase = browserSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  if (error) {
    console.error(error);
    setError(error.message);
    setBusy(false);
    return;
  }
  // Session is set. Hand off to the same callback so it runs access-check
  // and SSO resolve before landing on /dashboard.
  window.location.href = '/auth/callback';
}

type Stage = 'idle' | 'enter-email' | 'enter-code';

export function SignInButton() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 max-w-sm">
      <button
        type="button"
        onClick={() => startGoogleSignIn(setBusy, setError)}
        disabled={busy}
        className="w-full rounded-md bg-ink text-ink-inverse px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy && stage === 'idle' ? 'Redirecting…' : 'Continue with Google'}
      </button>

      {stage === 'idle' && (
        <button
          type="button"
          onClick={() => setStage('enter-email')}
          className="w-full text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
        >
          or sign in with an email code
        </button>
      )}

      {stage === 'enter-email' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) sendCode(email.trim(), setBusy, setStage, setError);
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
            if (code.trim()) verifyCode(email, code.trim(), setBusy, setError);
          }}
          className="space-y-2"
        >
          <div className="text-xs text-neutral-600">
            Check <strong>{email}</strong>. Enter the 6-digit code below, or
            click the link in the email.
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
            autoFocus
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base tracking-[0.4em] text-center font-mono focus:border-neutral-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
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
            className="block w-full text-center text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  );
}

/** Quieter sign-in entry point — used on the public landing page where
 *  Request Access is the primary action. Kicks off Google OAuth only. */
export function SignInLink() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => startGoogleSignIn(setBusy, setError)}
        disabled={busy}
        className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4 disabled:opacity-50"
      >
        {busy ? 'Redirecting…' : 'Already invited? Sign in →'}
      </button>
      {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
    </div>
  );
}
