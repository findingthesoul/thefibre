import { apiFetch } from '@/lib/api';
import type { OrganiserRow, TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { EMPTY_LIBRARY, type TemplateLibrary } from '@/components/template-cards';
import { NewThreadForm } from './form';

export default async function NewThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const locale = await uiLocale();
  // Auto-provisions the organiser row on first visit; the slug feeds the
  // public-URL prefix in the form.
  const [organiser, teams, library, params] = await Promise.all([
    apiFetch<OrganiserRow>('/api/v1/thread/me'),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({ items: [] })),
    // If the library can't load, the picker simply doesn't render — the form
    // still works, just without seeded elements.
    apiFetch<TemplateLibrary>('/api/v1/thread/template-library').catch(() => EMPTY_LIBRARY),
    searchParams,
  ]);

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/threads" label={t(locale, 'threads')} />
      <PageHeader title={t(locale, 'new_thread')} description={t(locale, 'new_thread_desc')} />
      <NewThreadForm
        locale={locale}
        organiserSlug={organiser.slug}
        teams={teams.items}
        library={library}
        initialTemplate={params.template ?? null}
      />
    </PageContainer>
  );
}
