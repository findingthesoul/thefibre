'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';

export function SignOutBlock() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function signOut() {
    setBusy(true);
    await browserSupabase().auth.signOut();
    router.push('/');
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4 disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
