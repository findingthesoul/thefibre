import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
  EmptyState,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ContactsSearch } from './search';
import { ContactRow, type Contact } from './contact-row';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = await uiLocale();
  const { q } = await searchParams;
  let items: Contact[] = [];
  let error: string | null = null;
  try {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    const r = await apiFetch<{ items: Contact[] }>(`/api/v1/meet/contacts${qs}`);
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title={t(locale, 'contacts_title')}
        description={t(locale, 'contacts_desc')}
      />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      <div className="mt-8">
        <ContactsSearch initial={q ?? ''} locale={locale} />
      </div>

      <section className="mt-6">
        {items.length === 0 ? (
          <EmptyState>{t(locale, 'contacts_empty')}</EmptyState>
        ) : (
          <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {items.map((c) => (
              <ContactRow key={c.id} contact={c} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
