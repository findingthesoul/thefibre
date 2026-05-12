'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

export function SignInButton() {
  const [busy, setBusy] = useState(false);

  async function signIn() {
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

  return (
    <button
      onClick={signIn}
      disabled={busy}
      className="rounded-md bg-ink text-ink-inverse px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </button>
  );
}
