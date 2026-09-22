'use server';

// The app-bound half of the shared To do panel: the calls to the platform
// list (/api/v1/tasks). The panel itself is
// @thefibre/shared/ui/todo-panel — same arrangement as the invoices area.

import { apiFetch } from './api';
import type { TodoItem, TodoGroups } from '@thefibre/shared/ui/todo-panel';

export async function listTasks(
  view: 'open' | 'archive',
): Promise<{ items: TodoItem[]; groups: TodoGroups } | null> {
  try {
    const data = await apiFetch<{ items: TodoItem[]; groups?: TodoGroups }>(
      `/api/v1/tasks?view=${view}`,
    );
    return { items: data.items, groups: data.groups ?? {} };
  } catch {
    // A panel that fails to load says nothing rather than breaking the page.
    return null;
  }
}

export async function addTask(title: string, dueOn: string | null): Promise<void> {
  await apiFetch('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, due_on: dueOn }),
  });
}

/** Tick, un-tick or snooze — one call for a typed row and for an app's item. */
export async function setTaskState(
  item: TodoItem,
  state: 'open' | 'done' | 'snoozed',
  snoozedUntil?: string | null,
): Promise<void> {
  if (item.id) {
    await apiFetch(`/api/v1/tasks/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ state, snoozed_until: snoozedUntil ?? null }),
    });
    return;
  }
  if (!item.source) return;
  await apiFetch('/api/v1/tasks/answer', {
    method: 'POST',
    body: JSON.stringify({
      source_app: item.source.app,
      source_ref: item.source.ref,
      state,
      snoozed_until: snoozedUntil ?? null,
      title: item.title,
      app: item.app,
      href: item.href,
      subject_label: item.subject?.label ?? null,
    }),
  });
}

export async function removeTask(item: TodoItem): Promise<void> {
  if (!item.id) return;
  await apiFetch(`/api/v1/tasks/${item.id}`, { method: 'DELETE' });
}
