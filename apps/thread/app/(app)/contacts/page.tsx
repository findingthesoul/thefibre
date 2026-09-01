import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ContactsList, type ContactItem } from './contacts-list';

export default async function ContactsPage() {
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
      <PageHeader
        title="Contacts"
        description="The people Thread knows — everyone who has enrolled in one of your threads."
      />

      {error && <ErrorBanner>Couldn&apos;t load contacts: {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>Contacts appear when people enrol in your threads.</EmptyState>
      )}

      {items.length > 0 && <ContactsList items={items} />}
    </PageContainer>
  );
}
