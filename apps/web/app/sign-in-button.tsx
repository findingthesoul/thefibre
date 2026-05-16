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

async function sendMagicLink(
  email: string,
  setBusy: (b: boolean) => void,
  setSent: (s: boolean) => void,
  setError: (e: string | null) => void,
) {
  setBusy(true);
  setError(null);
  const supabase = browserSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
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
  setSent(true);
}

export function SignInButton() {
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 max-w-sm">
        Check <strong>{email}</strong> — we sent a sign-in link. Click it from
        the same browser to finish signing in.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-sm">
      <button
        type="button"
        onClick={() => startGoogleSignIn(setBusy, setError)}
        disabled={busy}
        className="w-full rounded-md bg-ink text-ink-inverse px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Redirecting…' : 'Continue with Google'}
      </button>

      {!showEmail ? (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="w-full text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
        >
          or sign in with an email link
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim())
              sendMagicLink(email.trim(), setBusy, setSent, setError);
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
            {busy ? 'Sending…' : 'Email me a sign-in link'}
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
