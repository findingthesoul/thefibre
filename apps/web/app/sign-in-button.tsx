'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

// Remember where to land after sign-in, in a short-lived cookie the auth
// callback reads. A cookie rather than a `redirectTo` query param on purpose:
// the OAuth/magic-link redirect URL must match Supabase's allowlist, and
// appending `?next=` risks the whole sign-in being rejected — breaking it for
// everyone. The callback URL stays exactly what already works; the cookie
// rides alongside and cannot affect the allowlist. Same-origin, lax, 10 min.
function rememberNext(next: string | null): void {
  if (!next) return;
  try {
    document.cookie = `fibre_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
  } catch {
    /* cookies disabled — sign-in still works, just lands on the dashboard */
  }
}
function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

async function startGoogleSignIn(
  next: string | null,
  setBusy: (b: boolean) => void,
  setError: (e: string | null) => void,
) {
  setBusy(true);
  setError(null);
  rememberNext(next);
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

async function sendCode(
  email: string,
  next: string | null,
  setBusy: (b: boolean) => void,
  setStage: (s: 'enter-code') => void,
  setError: (e: string | null) => void,
) {
  setBusy(true);
  setError(null);
  rememberNext(next);
  const supabase = browserSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Email contains BOTH a one-time code and a magic-link as fallback.
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

async function verifyCode(
  email: string,
  code: string,
  next: string | null,
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
  // and SSO resolve before landing on the destination (the fibre_next cookie
  // set when the code was requested carries a /connect return, if any).
  rememberNext(next);
  window.location.href = callbackUrl();
}

type Stage = 'idle' | 'enter-email' | 'enter-code';

export function SignInButton({ next = null }: { next?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 max-w-sm">
      <button
        type="button"
        onClick={() => startGoogleSignIn(next, setBusy, setError)}
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
            if (email.trim()) sendCode(email.trim(), next, setBusy, setStage, setError);
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
            if (code.trim()) verifyCode(email, code.trim(), next, setBusy, setError);
          }}
          className="space-y-2"
        >
          <div className="text-xs text-neutral-600">
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
 *  Request Access is the primary action. Points to /sign-in, which offers
 *  Google + the 8-digit email-code flow. */
export function SignInLink() {
  return (
    <a
      href="/sign-in"
      className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
    >
      Already invited? Sign in →
    </a>
  );
}
