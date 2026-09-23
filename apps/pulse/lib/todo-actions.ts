'use server';

// The app-bound half of the shared To do panel: this app's apiFetch, bound to
// the platform list. The calls themselves live once, in
// @thefibre/shared/todo-calls; the panel is @thefibre/shared/ui/todo-panel.
// Same arrangement as the invoices area — seven identical copies of the
// fetching is exactly what the components-first rule forbids.

import { apiFetch } from './api';
import * as calls from '@thefibre/shared/todo-calls';
import type { TodoItem, TodoGroups } from '@thefibre/shared/ui/todo-panel';

export async function listTasks(
  view: 'open' | 'archive',
): Promise<{ items: TodoItem[]; groups: TodoGroups } | null> {
  return calls.listTasks(apiFetch, view);
}

export async function addTask(title: string, dueOn: string | null): Promise<void> {
  return calls.addTask(apiFetch, title, dueOn);
}

export async function setTaskState(
  item: TodoItem,
  state: 'open' | 'done' | 'snoozed',
  snoozedUntil?: string | null,
): Promise<void> {
  return calls.setTaskState(apiFetch, item, state, snoozedUntil);
}

export async function removeTask(item: TodoItem): Promise<void> {
  return calls.removeTask(apiFetch, item);
}
