import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES } from '@/lib/i18n-ui';
import { ProfileForm, type PublicProfile } from './profile-form';
import { LanguagePicker } from './language-picker';

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

const METHOD: Record<string, string> = {
  google: 'Google',
  magic_link: 'Emailed code',
  microsoft: 'Microsoft',
  linkedin: 'LinkedIn',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

export default async function ProfileSettingsPage() {
  const locale = await uiLocale();
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
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader
        title={t(locale, 'profile_title')}
        description={t(locale, 'profile_blurb')}
      />

      {error && <ErrorBanner>{t(locale, 'profile_load_failed')} {error}</ErrorBanner>}

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
            locale={locale}
          />
          <LanguagePicker initial={profile?.locale ?? null} locale={locale} />
          <section className="mt-12 border-t border-line pt-8">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              {t(locale, 'signing_in')}
            </div>
            <dl className="mt-3 rounded-lg border border-line bg-surface-raised p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label={t(locale, 'email_label')} value={me.user.email} />
              <Row
                label={t(locale, 'method')}
                value={
                  me.user.primary_auth_method === 'magic_link'
                    ? t(locale, 'emailed_code')
                    : METHOD[me.user.primary_auth_method ?? ''] ?? '—'
                }
              />
              {me.user.last_sign_in && (
                <Row
                  label={t(locale, 'last_sign_in')}
                  value={new Date(me.user.last_sign_in).toLocaleString(INTL_LOCALES[locale], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                />
              )}
            </dl>
            <p className="mt-3 text-xs text-ink-muted">{t(locale, 'email_identity_note')}</p>
          </section>
        </>
      )}
    </PageContainer>
  );
}
