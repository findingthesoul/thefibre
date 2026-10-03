import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { DirectoryClient } from '../directory-client';
import { loadSettings, type DirectoryCategory } from '../shared';

// The member directory's settings (docs/member-directory-spec.md slice 1).
// Slice 1 is the admin half only: the workspace switches and the category
// vocabulary. Nothing here lists a member yet — the list, the per-member
// opt-out and the tags are slices 2 to 4.

type Uncategorised = { count: number; items: { id: string; name: string }[] };

export default async function DirectorySettings() {
  const locale = await uiLocale();
  const { settings, adminOnly } = await loadSettings();

  // Both reads are admin-only on the API, so they are only worth making once
  // we know this viewer is one — and an error on either must not take the
  // page down, because the switches are still editable without them.
  const [categories, uncategorised] = adminOnly
    ? [[] as DirectoryCategory[], { count: 0, items: [] } as Uncategorised]
    : await Promise.all([
        apiFetch<{ items: DirectoryCategory[] }>(
          '/api/v1/membership/directory/categories?archived=true',
        )
          .then((r) => r.items)
          .catch(() => [] as DirectoryCategory[]),
        apiFetch<Uncategorised>('/api/v1/membership/directory/uncategorised-products').catch(
          () => ({ count: 0, items: [] }) as Uncategorised,
        ),
      ]);

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_directory_title')} description={t(locale, 'directory_desc')} />
      <div className="mt-8">
        {adminOnly ? (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            {t(locale, 'workspace_admins_only')}
          </p>
        ) : (
          <DirectoryClient
            visibility={settings?.directory_visibility ?? 'everybody'}
            showContact={settings?.directory_show_contact ?? false}
            showCategory={settings?.directory_show_category ?? false}
            defaultCategoryId={settings?.directory_default_category_id ?? null}
            categories={categories}
            uncategorised={uncategorised}
            locale={locale}
          />
        )}
      </div>
    </PageContainer>
  );
}
