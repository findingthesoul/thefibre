import { headers } from 'next/headers';
import { appUrl } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ContactsList, type ContactItem } from './contacts-list';

export default async function ContactsPage() {
  const locale = await uiLocale();
  // Where "Open in Fibre" points: the registry's platform URL, on this
  // deployment's apex (staging stays on staging).
  const fibreUrl = appUrl('fibre-platform', process.env, (await headers()).get('host'));
  let items: ContactItem[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: ContactItem[] }>('/api/v1/thread/contacts');
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'contacts')} description={t(locale, 'contacts_desc')} />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      {!error && items.length === 0 && <EmptyState>{t(locale, 'contacts_empty')}</EmptyState>}

      {items.length > 0 && <ContactsList locale={locale} items={items} fibreUrl={fibreUrl} />}
    </PageContainer>
  );
}
