'use client';

import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await browserSupabase().auth.signOut();
    router.push('/');
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="text-sm text-ink-500 hover:text-ink-900 underline underline-offset-2"
    >
      Sign out
    </button>
  );
}
