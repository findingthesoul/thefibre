import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner } from '@/components/ui/page';
import { ProfileForm, type PublicProfile } from './profile-form';

// One profile.
//
// This page used to carry two forms: "Your details" (full name, Avatar URL) on
// `user`, and "Public profile" (display name, bio, Photo URL, timezone) on
// `user_profile`. Two names and two pictures, in two tables, free to disagree
// — and neither of them was the good version, which was in The Thread all
// along. Sjoerd, 2026-09-01: "It should be one. The Thread should be leading."
//
// So: one form, The Thread's design, and the facts that are not editable
// (email, how you sign in, when you last did) stated underneath as facts.

export const metadata = { title: 'Profile · The Fibre' };

type Me = {
  user: {
    email: string;
    full_name: string | null;
    primary_auth_method: string | null;
    last_sign_in: string | null;
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
        description="Who you are on The Fibre. Every app inherits this."
      />

      {error && <ErrorBanner>Couldn&apos;t load your profile: {error}</ErrorBanner>}

      {me && (
        <>
          <ProfileForm
            profile={
              profile ?? {
                display_name: me.user.full_name,
                bio: null,
                photo_url: null,
                timezone: null,
              }
            }
            email={me.user.email}
          />
          <div className="mt-10 border-t border-line pt-6 text-xs text-ink-muted space-y-1">
            <div>
              <span className="uppercase tracking-wider">Email</span> · {me.user.email}{' '}
              <span>— managed by your identity provider</span>
            </div>
            <div>
              <span className="uppercase tracking-wider">Sign-in method</span> ·{' '}
              {me.user.primary_auth_method ?? '—'}
            </div>
            {me.user.last_sign_in && (
              <div>
                <span className="uppercase tracking-wider">Last sign-in</span> ·{' '}
                {new Date(me.user.last_sign_in).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
