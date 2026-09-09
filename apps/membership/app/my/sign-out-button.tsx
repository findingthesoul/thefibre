'use client';

// The app-bound half of the shared SignOut: this app's Supabase browser
// client, and where a member lands afterwards (back to /my, signed out,
// which shows the sign-in form rather than a blank page).

import { SignOut } from '@thefibre/shared/ui/sign-out';
import { browserSupabase } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

export function SignOutButton({ locale }: { locale: Locale }) {
  return (
    <SignOut
      label={t(locale, 'sign_out')}
      busyLabel={t(locale, 'signing_out')}
      onSignOut={async () => {
        await browserSupabase().auth.signOut();
        window.location.href = '/my';
      }}
    />
  );
}
