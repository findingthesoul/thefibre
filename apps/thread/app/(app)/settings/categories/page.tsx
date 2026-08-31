// Settings → Categories (Sjoerd 2026-08-31): the curated list threads pick
// from — "It is not tags." Workspace-wide by default; "Only me" scopes one
// to your organiser profile. Renames keep the slug, because the slug is the
// public filter other websites may already embed.

import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { CategoriesManager, type CategoryRow } from './categories-manager';

export default async function CategoriesSettingsPage() {
  const [{ items }, me] = await Promise.all([
    apiFetch<{ items: CategoryRow[] }>('/api/v1/thread/categories').catch(() => ({
      items: [] as CategoryRow[],
    })),
    apiFetch<{ id: string }>('/api/v1/thread/me'),
  ]);

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Categories"
        description="The list threads choose from — on public listings and website embeds, visitors can filter by these."
      />
      <CategoriesManager initial={items} myOrganiserId={me.id} />
    </PageContainer>
  );
}
