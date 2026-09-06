import { apiFetch, ApiError } from '@/lib/api';
import { INTL_LOCALES } from '@thefibre/shared';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';

type Me = {
  user: { full_name: string | null; email: string };
  workspace: { id: string; name: string; plan: string } | null;
};

export default async function ThreadDashboard() {
  const locale = await uiLocale();
  let me: Me | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const firstName =
    me?.user.full_name?.split(/\s+/)[0] ?? me?.user.email?.split('@')[0] ?? '';
  const today = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'dash_welcome', { name: firstName })} description={today} />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <SectionLabel>{t(locale, 'dash_what_lives_here')}</SectionLabel>
          <ul className="mt-3 space-y-3 text-sm text-ink-subtle leading-relaxed">
            <li>· {t(locale, 'dash_lives_1')}</li>
            <li>· {t(locale, 'dash_lives_2')}</li>
            <li>· {t(locale, 'dash_lives_3')}</li>
            <li>· {t(locale, 'dash_lives_4')}</li>
          </ul>
        </div>
        <div>
          <SectionLabel>{t(locale, 'dash_what_stays')}</SectionLabel>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            {t(locale, 'dash_stays_body')}
          </p>
        </div>
      </section>

      <section className="mt-14">
        <EmptyState>{t(locale, 'dash_skeleton')}</EmptyState>
      </section>
    </PageContainer>
  );
}
