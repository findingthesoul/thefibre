import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { MemberPageClient, type MemberDocument } from './member-page-client';

// The community page members see in my.thread (item 4): an intro written
// here, the documents uploaded here, plus what members' own threads have
// sent them and what is next — those two come from Thread, not from here.

export default async function MemberPageSettings() {
  const locale = await uiLocale();
  const page = await apiFetch<{ intro_html: string | null; documents: MemberDocument[] }>(
    '/api/v1/membership/member-page',
  ).catch(() => null);
  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_member_page_title')} description={t(locale, 'st_member_page_desc')} />
      <div className="mt-8">
        {page ? (
          <MemberPageClient intro={page.intro_html} documents={page.documents} locale={locale} />
        ) : (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            {t(locale, 'workspace_admins_only')}
          </p>
        )}
      </div>
    </PageContainer>
  );
}
