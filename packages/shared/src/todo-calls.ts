// The four calls the To do panel makes, in one place.
//
// Every app's topbar carries the same panel, so without this each app would
// hold its own copy of the same four fetches — the drift the components-first
// rule exists to prevent. Shared decides WHAT (the paths, the two ways an
// item is addressed); the caller decides HOW (its own apiFetch binding, its
// 'use server' wrapper). Same arrangement as app-shell.ts; no framework
// import here.
//
// The endpoints live at /api/v1/tasks — NOT under /api/v1/me/, which is a
// public prefix for the visitor portal and leaves a handler without a signed
// -in context (caught on staging, 2026-09-23).

import type { ApiFetch } from './api-fetch.js';
import type { TodoItem, TodoGroups } from './ui/todo-panel.js';

export async function listTasks(
  apiFetch: ApiFetch,
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

export async function addTask(
  apiFetch: ApiFetch,
  title: string,
  dueOn: string | null,
): Promise<void> {
  await apiFetch('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, due_on: dueOn }),
  });
}

/**
 * Tick, un-tick or snooze. Two shapes of item reach this: one you typed, which
 * has an id of its own, and one an app owns (a Flow task), which has none —
 * that one is addressed by its source pair and upserted, so the platform can
 * remember your answer about a row it does not own.
 */
export async function setTaskState(
  apiFetch: ApiFetch,
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

/** Only your own typed rows can be removed; an app's item is not ours to delete. */
export async function removeTask(apiFetch: ApiFetch, item: TodoItem): Promise<void> {
  if (!item.id) return;
  await apiFetch(`/api/v1/tasks/${item.id}`, { method: 'DELETE' });
}
