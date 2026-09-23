import { PageContainer, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { apiFetch } from '@/lib/api';
import { TodoTemplatesClient, type TodoTemplateRow } from './todo-templates-client';

// The third group in Templates (Sjoerd 2026-09-23): reusable checklists you
// drop onto a thread. Same table as thread templates, `kind = 'todo'`.
export default async function TodoTemplatesPage() {
  const locale = await uiLocale();
  // A failure here is not "you have none" — the client is told which it was,
  // so it can say so rather than drawing an empty state over a list that
  // exists (docs/testing-approach.md §1.7).
  let items: TodoTemplateRow[] = [];
  let loadError: string | null = null;
  try {
    const data = await apiFetch<{ items: TodoTemplateRow[] }>('/api/v1/thread/todo-templates');
    items = data.items;
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Could not load';
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title={t(locale, 'todo_templates')}
        description={t(locale, 'todo_templates_card_desc')}
      />
      <TodoTemplatesClient locale={locale} initial={items} loadError={loadError} />
    </PageContainer>
  );
}
