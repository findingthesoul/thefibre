'use server';

// Server actions for the to-do TEMPLATES page (Templates → To-do lists).
// The per-thread list has its own actions beside the thread editor; this
// file is only the library.

import { apiFetch, errorMessage } from '@/lib/api';

export type TodoTemplateItem = {
  title: string;
  notes?: string | null;
  /** Days from the thread's start. Negative = before it begins. */
  day_offset?: number | null;
  position?: number;
};

export type TodoTemplateRow = {
  id: string;
  title: string;
  scope: 'personal' | 'team' | 'workspace';
  structure: { version: number; tasks: TodoTemplateItem[] };
  updated_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createTodoTemplate(input: {
  title: string;
  scope: 'personal' | 'team' | 'workspace';
  structure: { version: 1; tasks: TodoTemplateItem[] };
}): Promise<Result<TodoTemplateRow>> {
  try {
    const data = await apiFetch<TodoTemplateRow>('/api/v1/thread/todo-templates', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateTodoTemplate(
  id: string,
  patch: {
    title?: string;
    scope?: 'personal' | 'team' | 'workspace';
    structure?: { version: 1; tasks: TodoTemplateItem[] };
  },
): Promise<Result<TodoTemplateRow>> {
  try {
    const data = await apiFetch<TodoTemplateRow>(`/api/v1/thread/todo-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteTodoTemplate(id: string): Promise<Result<null>> {
  try {
    await apiFetch(`/api/v1/thread/todo-templates/${id}`, { method: 'DELETE' });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function reloadTodoTemplates(): Promise<Result<TodoTemplateRow[]>> {
  try {
    const data = await apiFetch<{ items: TodoTemplateRow[] }>('/api/v1/thread/todo-templates');
    return { ok: true, data: data.items };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
