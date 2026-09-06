import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { TasksList, type Task } from './tasks-list';

export const metadata = { title: 'Tasks — Flow' };

export default async function TasksPage() {
  const locale = await uiLocale();
  let items: Task[] = [];
  let loadError: string | null = null;
  try {
    const r = await apiFetch<{ items: Task[] }>('/api/v1/flow/tasks?scope=mine&status=open');
    items = r.items;
  } catch {
    loadError = t(locale, 'load_tasks_failed');
  }

  return (
    <div className="px-6 py-10 max-w-3xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t(locale, 'my_tasks')}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t(locale, 'tasks_blurb')}</p>

      {loadError ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <TasksList initial={items} locale={locale} />
      )}
    </div>
  );
}
