'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

async function startGoogleSignIn(setBusy: (b: boolean) => void) {
  setBusy(true);
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
    setBusy(false);
  }
  // On success, browser redirects to Google.
}

export function SignInButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={() => startGoogleSignIn(setBusy)}
      disabled={busy}
      className="rounded-md bg-ink text-ink-inverse px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </button>
  );
}

/** Quieter sign-in entry point for surfaces where Request Access is primary. */
export function SignInLink() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={() => startGoogleSignIn(setBusy)}
      disabled={busy}
      className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4 disabled:opacity-50"
    >
      {busy ? 'Redirecting…' : 'Already invited? Sign in →'}
    </button>
  );
}
