'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

export function SignInButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = browserSupabase();
    const callback = next
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callback,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      console.error(error);
      setBusy(false);
    }
  }

  return (
    <button
      onClick={signIn}
      disabled={busy}
      className="rounded-md bg-ink text-ink-inverse px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </button>
  );
}
