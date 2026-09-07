import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { COOKIE_WELCOME } from '@/lib/prefs-shared';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import type { PublicProfile } from '../(app)/settings/profile/profile-form';
import { WelcomeFlow } from './welcome-flow';

// First-login sequence — OUTSIDE the (app) shell on purpose: no sidebar, no
// tabs, just the steps. The dashboard sends people here when their
// identity_profile is still empty (derived — no wizard state); this page
// itself never traps: already-done or already-dismissed → dashboard.

export default async function WelcomePage() {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const store = await cookies();
  if (store.get(COOKIE_WELCOME)?.value === 'done') redirect('/dashboard');

  let profile: PublicProfile;
  try {
    profile = await apiFetch<PublicProfile>('/api/v1/profile');
  } catch {
    redirect('/dashboard'); // the sequence is a nicety — never a wall
  }

  const locale = await uiLocale(profile.locale);

  return (
    <LocaleProvider locale={locale}>
      <div className="min-h-dvh bg-surface">
        <WelcomeFlow profile={profile} email={user.email ?? ''} locale={locale} />
      </div>
    </LocaleProvider>
  );
}
