import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SectionLabel,
  ErrorBanner,
} from '@/components/ui/page';
import { ProfileForm, PublicProfileForm, type PublicProfile } from '../profile-form';

// Your profile as its own page, matching Meet, Thread and Pulse — which all
// have /settings/profile. The platform was the odd one out: these two sections
// lived inline on /settings, so the user menu had a "Profile" entry that could
// only point at the same page as "Settings".

export const metadata = { title: 'Profile · The Fibre' };

type Me = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    primary_auth_method: string | null;
    last_sign_in: string | null;
    person_id: string | null;
  };
};

export default async function ProfileSettingsPage() {
  let me: Me | null = null;
  let profile: PublicProfile | null = null;
  let error: string | null = null;

  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // The public profile is a separate resource — failing to load it shouldn't
  // take the whole page down with it.
  try {
    profile = await apiFetch<PublicProfile>('/api/v1/profile');
  } catch {
    profile = null;
  }

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Profile"
        description="Who you are on The Fibre — your name, how you sign in, and the profile every Fibre app inherits."
      />

      {error && <ErrorBanner>Couldn't load your profile: {error}</ErrorBanner>}

      {me && (
        <>
          <section className="mt-12">
            <SectionLabel>Your details</SectionLabel>
            <ProfileForm me={me.user} />
            <div className="mt-6 text-xs text-ink-muted space-y-1">
              <div>
                <span className="uppercase tracking-wider">Email</span> · {me.user.email}{' '}
                <span className="text-ink-muted">— managed by your identity provider</span>
              </div>
              <div>
                <span className="uppercase tracking-wider">Sign-in method</span>{' '}
                · {me.user.primary_auth_method ?? '—'}
              </div>
              {me.user.last_sign_in && (
                <div>
                  <span className="uppercase tracking-wider">Last sign-in</span>{' '}
                  ·{' '}
                  {new Date(me.user.last_sign_in).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="mt-14">
            <SectionLabel>Public profile</SectionLabel>
            <p className="mt-1 text-xs text-ink-muted">
              Shared across the Fibre apps — Meet and Thread inherit these.
            </p>
            {profile ? (
              <PublicProfileForm profile={profile} />
            ) : (
              <p className="mt-3 text-sm text-ink-subtle">
                Couldn't load your public profile right now.
              </p>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
