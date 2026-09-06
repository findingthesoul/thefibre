import { apiFetch } from '@/lib/api';
import type { OrganiserRow, TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { NewThreadForm } from './form';

export default async function NewThreadPage() {
  const locale = await uiLocale();
  // Auto-provisions the organiser row on first visit; the slug feeds the
  // public-URL prefix in the form.
  const [organiser, teams] = await Promise.all([
    apiFetch<OrganiserRow>('/api/v1/thread/me'),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({ items: [] })),
  ]);

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/threads" label={t(locale, 'threads')} />
      <PageHeader title={t(locale, 'new_thread')} description={t(locale, 'new_thread_desc')} />
      <NewThreadForm locale={locale} organiserSlug={organiser.slug} teams={teams.items} />
    </PageContainer>
  );
}
