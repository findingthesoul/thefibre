'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';
import { acceptInvite } from './actions';

export function InviteSignInButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    const supabase = browserSupabase();
    const next = encodeURIComponent(`/invite/${token}`);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
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
      type="button"
      onClick={signIn}
      disabled={busy}
      className="rounded-md bg-neutral-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-neutral-700 disabled:opacity-50"
    >
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </button>
  );
}

export function AcceptForm({
  token,
  teamSlug,
}: {
  token: string;
  teamSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const r = await acceptInvite(token);
      if (r.error) setError(r.error);
      else router.push(`/${teamSlug}`);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="rounded-md bg-neutral-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-neutral-700 disabled:opacity-50"
      >
        {pending ? 'Joining…' : 'Accept invite'}
      </button>
      {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}
