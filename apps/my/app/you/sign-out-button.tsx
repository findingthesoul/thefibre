'use client';

// The app-bound half of the shared SignOut: this app's Supabase browser
// client, and where a member lands afterwards (back to the portal, signed
// out, which shows the sign-in form rather than a blank page).

import { SignOut } from '@thefibre/shared/ui/sign-out';
import { browserSupabase } from '@/lib/supabase/client';

export function SignOutButton() {
  return (
    <SignOut
      busyLabel="Signing out…"
      onSignOut={async () => {
        await browserSupabase().auth.signOut();
        window.location.href = '/';
      }}
    />
  );
}
