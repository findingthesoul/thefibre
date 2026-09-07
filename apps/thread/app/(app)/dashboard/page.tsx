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
import { TemplateCard, type TemplateLibrary } from '@/components/template-cards';

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

  // First-event onboarding is DERIVED state, not a wizard: zero threads in
  // the workspace → the dashboard leads with the five standard event shapes.
  // On any fetch failure, no hero — the dashboard stays its plain self.
  const threads = await apiFetch<{ items: unknown[] }>('/api/v1/thread/threads').catch(
    () => null,
  );
  const library: TemplateLibrary | null =
    threads && threads.items.length === 0
      ? await apiFetch<TemplateLibrary>('/api/v1/thread/template-library').catch(() => null)
      : null;
  const firstEvent = library && library.templates.length > 0 ? library : null;

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

      {firstEvent && (
        <section className="mt-10">
          <h2 className="text-lg font-medium tracking-tight">
            {t(locale, 'dash_first_title')}
          </h2>
          <p className="mt-1.5 text-sm text-ink-subtle leading-relaxed max-w-xl">
            {t(locale, 'dash_first_desc')}
          </p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {firstEvent.templates.map((tp) => (
              <TemplateCard
                key={tp.id}
                locale={locale}
                template={tp}
                href={`/threads/new?template=${tp.id}`}
              />
            ))}
          </div>
        </section>
      )}

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
